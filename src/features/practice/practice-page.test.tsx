import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import type { Question, SubjectId } from '@/lib/types';
import { PRACTICE_SESSION_STORAGE_KEY, type PracticeSession } from './practice-session';
import { PracticePage } from './practice-page';
import { keepPracticeResult } from './practice-result-memory';
import styles from './practice-page.module.css';

type RouteInput = string | { pathname: string; query?: Record<string, string | number> };

// Behaves like Next's shallow routing over jsdom's real history: a push gets a
// new key and a replace keeps it, a full load gets a new one, and Back/Forward
// rewrite the landed entry's state (keeping its key) before the page sees it.
const router = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let keys = 0;
  function toUrl(input: RouteInput) {
    if (typeof input === 'string') return input;
    const search = new URLSearchParams(
      Object.entries(input.query ?? {}).map(([key, value]) => [key, String(value)]),
    ).toString();
    return `${input.pathname}${search ? `?${search}` : ''}`;
  }
  function currentKey() {
    return (window.history.state as { key?: string } | null)?.key;
  }
  const api = {
    snapshot: { asPath: '/practice/quiz', query: {} as Record<string, string> },
    /** Set when Back/Forward leaves the page, where the real page would unmount. */
    left: false,
    show(url: string) {
      const parsed = new URL(url, 'http://localhost');
      api.snapshot = {
        asPath: `${parsed.pathname}${parsed.search}`,
        query: Object.fromEntries(parsed.searchParams),
      };
      listeners.forEach((listener) => listener());
    },
    write(method: 'pushState' | 'replaceState', input: RouteInput, newKey = false) {
      const url = toUrl(input);
      const key =
        method === 'replaceState' && !newKey && currentKey()
          ? currentKey()
          : `k${++keys}`;
      window.history[method]({ __N: true, as: url, key }, '', url);
      api.show(url);
    },
    /** Arrives on the page with a new entry. */
    visit(url: string) {
      api.left = false;
      api.write('pushState', url);
    },
    /** A navigator link. */
    link(url: string) {
      api.write('pushState', url);
    },
    /** A full reload: the same entry under a new key. */
    reload() {
      api.write(
        'replaceState',
        `${window.location.pathname}${window.location.search}`,
        true,
      );
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push: vi.fn(),
    replace: vi.fn(),
  };
  window.addEventListener('popstate', (event) => {
    if (window.location.pathname !== '/practice/quiz') {
      api.left = true;
      return;
    }
    const url = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(
      { __N: true, as: url, key: (event.state as { key?: string } | null)?.key },
      '',
      url,
    );
    api.show(url);
  });
  return api;
});

vi.mock('next/router', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useRouter: () => {
      const snapshot = useSyncExternalStore(router.subscribe, () => router.snapshot);
      return {
        ...snapshot,
        pathname: '/practice/quiz',
        isReady: true,
        push: router.push,
        replace: router.replace,
      };
    },
  };
});

const appState = vi.hoisted(() => ({
  state: {
    difficultQuestionIds: [] as string[],
    notes: {} as Record<string, string>,
    noteImages: {} as Record<string, []>,
    readingPreferences: { questionFontSize: 18, optionFontSize: 18 },
  },
  dispatch: vi.fn(),
  reportPersistence: vi.fn(),
}));
vi.mock('@/state/app-state', () => ({ useAppState: () => appState }));

vi.mock('@/lib/shared-discussions', () => ({
  useSharedDiscussions: () => ({ posts: [], loading: false, error: '' }),
  useDiscussionPublisher: () => ({ publish: vi.fn(), enabled: false }),
}));

const paperDownload = vi.hoisted(() => vi.fn());
vi.mock('@/features/daily/daily-paper-pdf', () => ({
  downloadDailyPaperPdf: paperDownload,
}));

function makeQuestion(
  subject: SubjectId,
  year: number,
  number: number,
  { law = '建築技術規則', allCredit = false } = {},
): Question {
  return {
    id: `${subject}-${year}-${String(number).padStart(2, '0')}`,
    subject,
    year,
    questionNumber: number,
    topic: law,
    primaryCategory: law,
    tags: [],
    relatedLaws: [law],
    text: `${subject} ${year} 第 ${number} 題`,
    content: [{ kind: 'text', text: `${subject} ${year} 第 ${number} 題` }],
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: allCredit ? { kind: 'all-credit' } : { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

// 60 regular law questions over three years (15 of them 建築法) and two 一律給分.
const lawQuestions = Array.from({ length: 60 }, (_, index) =>
  makeQuestion('law', 114 - (index % 3), index + 1, {
    law: index % 4 === 0 ? '建築法' : '建築技術規則',
  }),
);
const allCreditQuestions = [
  makeQuestion('law', 114, 61, { law: '建築法', allCredit: true }),
  makeQuestion('law', 113, 62, { law: '建築法', allCredit: true }),
];
// 12 env questions in 113–114, a third of them also tagged 建築法.
const envQuestions = Array.from({ length: 12 }, (_, index) =>
  makeQuestion('env', 114 - (index % 2), index + 1, {
    law: index % 3 === 0 ? '建築法' : '環境控制',
  }),
);
const bank = [...lawQuestions, ...allCreditQuestions, ...envQuestions];
const bankState = vi.hoisted(() => ({
  status: 'ready' as 'ready' | 'loading' | 'error',
}));
vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: (subjects: SubjectId[]) => ({
    questions:
      bankState.status === 'loading'
        ? []
        : bank.filter((question) => subjects.includes(question.subject)),
    status: bankState.status,
    retry: vi.fn(),
  }),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  keepPracticeResult(null);
  // The page the user came from: Back past the set should land here.
  window.history.pushState({ outside: true }, '', '/elsewhere');
  router.left = false;
  bankState.status = 'ready';
  router.push.mockReset().mockImplementation(async (input: RouteInput) => {
    router.write('pushState', input);
    return true;
  });
  router.replace.mockReset().mockImplementation(async (input: RouteInput) => {
    router.write('replaceState', input);
    return true;
  });
  appState.dispatch.mockReset();
  appState.reportPersistence.mockReset();
  appState.state.difficultQuestionIds = [];
  paperDownload.mockReset().mockResolvedValue(undefined);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderPage() {
  return render(
    <ToastProvider>
      <PracticePage />
    </ToastProvider>,
  );
}

function renderAt(url = '/practice/quiz') {
  router.visit(url);
  return renderPage();
}

/** A full reload: the same entry under a new key, and the app's memory starts empty. */
function reload() {
  keepPracticeResult(null);
  router.reload();
}

/** Back (negative) or Forward, with jsdom delivering popstate inside act. */
async function traverse(delta: number) {
  await act(async () => {
    window.history.go(delta);
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

/** Lets the page's own rewind over a set's entries arrive. */
async function settleHistory() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
}

function stored(): PracticeSession | null {
  const raw = window.localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function makeSession(overrides: Partial<PracticeSession>, count = 5): PracticeSession {
  return {
    version: 1,
    id: 'seeded',
    subject: 'law',
    rangeStart: 112,
    rangeEnd: 114,
    category: 'all',
    questionIds: lawQuestions.slice(0, count).map((question) => question.id),
    optionOrders: {},
    answers: {},
    drafts: {},
    eliminated: {},
    elapsedSeconds: {},
    currentIndex: 0,
    ...overrides,
  };
}

function seed(overrides: Partial<PracticeSession>, count = 5) {
  const session = makeSession(overrides, count);
  window.localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

const allCorrect = Object.fromEntries(
  lawQuestions
    .slice(0, 5)
    .map((question) => [question.id, { selected: 0, correct: true }]),
);

async function openAdvanced() {
  await chooseDefaultSubject();
  fireEvent.click(await screen.findByRole('button', { name: /進階選項/ }));
}

async function chooseDefaultSubject() {
  await screen.findByRole('region', { name: '每日抽題練習設定' });
  if (!screen.getAllByRole('radio').some(radio => (radio as HTMLInputElement).checked)) {
    fireEvent.click(screen.getByRole('radio', { name: /建築法規與實務/ }));
  }
}

async function startOnline() {
  await chooseDefaultSubject();
  fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
}

function chooseOption(text: string) {
  fireEvent.click(screen.getByText(text).closest('label')!);
}

/** Radios are named by their group, so find one through its option text. */
function optionRadio(text: string) {
  return screen.getByText(text).closest('label')!.querySelector('[role="radio"]')!;
}

function questionRegion() {
  return screen.getByRole('region', { name: '題目與選項' });
}

async function finishPractice(available = true) {
  const total = stored()!.questionIds.length;
  act(() => router.link(`/practice/quiz?q=${total}`));
  if (available) {
    await screen.findByLabelText(`第 ${total} 題，共 ${total} 題`);
    const confirm = screen.queryByRole('button', { name: '確認答案' });
    if (confirm) {
      chooseOption('選項 A');
      fireEvent.click(confirm);
    }
  }
  fireEvent.click(await screen.findByRole('button', { name: '完成練習' }));
}

function submitFromFooter() {
  fireEvent.click(
    within(screen.getByRole('article')).getByRole('button', { name: /完成練習/ }),
  );
}

/** Another tab writing the set: the event only ever reaches the other tabs. */
function writeFromOtherTab(value: PracticeSession | null) {
  const newValue = value ? JSON.stringify(value) : null;
  if (newValue) window.localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, newValue);
  else window.localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key: PRACTICE_SESSION_STORAGE_KEY, newValue }),
    );
  });
}

describe('PracticePage setup', () => {
  it('starts from the daily defaults and keeps everything but the subject in the advanced options', async () => {
    renderAt();
    const setup = await screen.findByRole('region', { name: '每日抽題練習設定' });
    expect(within(setup).queryByText(/闖關/)).not.toBeInTheDocument();
    expect(within(setup).getAllByRole('radio')).toHaveLength(4);
    expect(within(setup).getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole('button', { name: '線上作答' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '製作紙本檔案' })).toBeDisabled();
    expect(screen.getByText('請先選擇科目，再開始練習。')).toBeInTheDocument();
    await chooseDefaultSubject();
    const toggle = screen.getByRole('button', { name: /進階選項/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent(
      '50 題・112–114 年・全部類別・打亂選項・不含一律給分',
    );
    expect(screen.getByLabelText('起始年度')).not.toBeVisible();
    expect(screen.getByText('已選 法規・從 60 題中抽 50 題')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('起始年度')).toBeVisible();
    expect(screen.getByRole('button', { name: /^50 題/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /打亂選項順序/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /包含一律給分題目/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: '恢復預設' })).toBeDisabled();
  });

  it('applies year, category, count and option settings, then restores the defaults', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt();
    await openAdvanced();
    fireEvent.change(screen.getByLabelText('起始年度'), { target: { value: '113' } });
    fireEvent.change(screen.getByRole('combobox', { name: '題目類別' }), {
      target: { value: '建築法' },
    });
    expect(screen.getByText(/共 10 題/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /包含一律給分題目/ }));
    // Turning 一律給分 on resets the category, as its counts change.
    fireEvent.change(screen.getByRole('combobox', { name: '題目類別' }), {
      target: { value: '建築法' },
    });
    expect(screen.getByText(/共 12 題/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^10 題/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /打亂選項順序/ }));
    expect(screen.getByRole('button', { name: /進階選項/ })).toHaveTextContent(
      '已調整10 題・113–114 年・建築法・原始選項順序・含一律給分',
    );

    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    await screen.findByRole('region', { name: '題目與選項' });
    const session = stored()!;
    expect(session.questionIds).toHaveLength(10);
    const drawn = session.questionIds.map((id) =>
      bank.find((question) => question.id === id)!,
    );
    expect(
      drawn.every(
        (question) => question.relatedLaws?.includes('建築法') && question.year >= 113,
      ),
    ).toBe(true);
    expect(session.optionOrders).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: /重新選科／設定/ }));
    await openAdvanced();
    fireEvent.click(screen.getByRole('button', { name: '恢復預設' }));
    expect(screen.getByRole('button', { name: /進階選項/ })).toHaveTextContent(
      '50 題・112–114 年・全部類別・打亂選項・不含一律給分',
    );
  });

  it('resets the year range and category when the subject changes, keeping count and options', async () => {
    renderAt();
    await openAdvanced();
    fireEvent.click(screen.getByRole('button', { name: /^10 題/ }));
    fireEvent.change(screen.getByLabelText('起始年度'), { target: { value: '114' } });
    fireEvent.change(screen.getByRole('combobox', { name: '題目類別' }), {
      target: { value: '建築法' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /打亂選項順序/ }));
    fireEvent.click(screen.getByRole('radio', { name: /建築環境控制/ }));
    // 114 and 建築法 exist in env too: only a reset gives the full range and all categories.
    expect(screen.getByRole('button', { name: /進階選項/ })).toHaveTextContent(
      '10 題・113–114 年・全部類別・原始選項順序・不含一律給分',
    );
    expect(screen.getByText('已選 環控・從 12 題中抽 10 題')).toBeInTheDocument();
  });

  it('makes the paper from its own draw without starting online practice', async () => {
    renderAt();
    await chooseDefaultSubject();
    fireEvent.click(await screen.findByRole('button', { name: '製作紙本檔案' }));
    await waitFor(() => expect(paperDownload).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '製作紙本檔案' }));
    await waitFor(() => expect(paperDownload).toHaveBeenCalledTimes(2));
    const [first, second] = paperDownload.mock.calls.map(([paper]) => paper);
    expect(first).toMatchObject({ subjectName: '建築法規與實務' });
    expect(first.answerKeyNote).toBeUndefined();
    expect(first.questions).toHaveLength(50);
    expect(first.referenceAnswers).toHaveLength(50);
    expect(first.questions.map((question: Question) => question.id)).not.toEqual(
      second.questions.map((question: Question) => question.id),
    );
    expect(
      first.questions.some(
        (question: Question) =>
          question.id.endsWith('-61') || question.id.endsWith('-62'),
      ),
    ).toBe(false);
    expect(stored()).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: '每日抽題練習設定' })).toBeInTheDocument();
  });
});

describe('PracticePage arriving from other pages', () => {
  it('requires a fresh subject on every entry and confirms before replacing unfinished answers', async () => {
    const original = seed({ subject: 'env', questionIds: envQuestions.slice(0, 5).map(question => question.id),
      answers: { 'env-114-01': { selected: 0, correct: true } }, currentIndex: 2 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const view = renderAt('/practice/quiz');
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(stored()).toEqual(original);
    await chooseDefaultSubject();
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    expect(confirm).toHaveBeenCalledWith('開始新題組會取代未完成的練習進度，確定要繼續嗎？');
    expect(stored()).toEqual(original);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    await screen.findByLabelText('第 1 題，共 50 題');
    expect(stored()!.subject).toBe('law');
    expect(stored()!.answers).toEqual({});
    view.unmount();
    renderAt('/practice/quiz');
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(appState.dispatch).not.toHaveBeenCalled();
  });

  it('opens the setup with the subject a link chose, and drops it from the URL', async () => {
    renderAt('/practice/quiz?subject=env');
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /建築環境控制/ })).toBeChecked(),
    );
    await waitFor(() => expect(router.snapshot.asPath).toBe('/practice/quiz'));
    expect(screen.getByRole('radio', { name: /建築法規與實務/ })).not.toBeChecked();
  });

  it('opens the setup with 考題分析’s year range and category, and drops them from the URL', async () => {
    renderAt(
      `/practice/quiz?subject=env&from=114&to=114&category=${encodeURIComponent('建築法')}`,
    );
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /建築環境控制/ })).toBeChecked(),
    );
    await waitFor(() => expect(router.snapshot.asPath).toBe('/practice/quiz'));
    // env 114 has six questions, two of them tagged 建築法.
    expect(screen.getByRole('button', { name: /進階選項/ })).toHaveTextContent(
      '2 題・114–114 年・建築法',
    );
    expect(screen.getByRole('button', { name: /進階選項/ })).toHaveTextContent('已調整');
  });

  it('opens the requested setup without discarding a saved set or retaining its subject', async () => {
    const original = seed({ currentIndex: 2, answers: { 'law-114-01': { selected: 0, correct: true } } });
    renderAt('/practice/quiz?subject=env');
    await waitFor(() => expect(screen.getByRole('radio', { name: /建築環境控制/ })).toBeChecked());
    await waitFor(() => expect(router.snapshot.query).toEqual({}));
    expect(stored()).toEqual(original);
    fireEvent.click(screen.getByRole('button', { name: '繼續未完成練習' }));
    await screen.findByLabelText('第 3 題，共 5 題');
  });

  it('keeps a submitted result for a trip to the hub, until the set is answered again', async () => {
    seed({ answers: allCorrect, currentIndex: 4 });
    const view = renderAt('/practice/quiz?q=5');
    await screen.findByLabelText('第 5 題，共 5 題');
    submitFromFooter();
    await screen.findByText('100% 正確率');
    view.unmount();

    // Back from the hub to the result's entry.
    const back = renderAt('/practice/quiz?view=result');
    expect(await screen.findByText('100% 正確率')).toBeInTheDocument();
    back.unmount();

    const again = renderAt('/practice/quiz?q=1');
    await screen.findByLabelText('第 1 題，共 5 題');
    chooseOption('選項 B');
    again.unmount();
    renderAt('/practice/quiz?view=result');
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '1' }));
    expect(screen.queryByText('100% 正確率')).not.toBeInTheDocument();
  });
});

describe('PracticePage answering', () => {
  it('draws a fresh shuffled set every time and replaces the setup URL with the first question', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt();
    await startOnline();
    await screen.findByRole('region', { name: '題目與選項' });
    expect(router.replace).toHaveBeenLastCalledWith(
      { pathname: '/practice/quiz', query: { q: 1 } },
      undefined,
      { shallow: true, scroll: false },
    );
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    const first = stored()!;
    expect(first.questionIds).toHaveLength(50);
    expect(first.questionIds.every((id) => id.startsWith('law-'))).toBe(true);
    expect(first.questionIds).not.toContain('law-114-61');
    expect(Object.keys(first.optionOrders)).toHaveLength(50);
    expect(screen.getByLabelText('第 1 題，共 50 題')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /重新選科／設定/ }));
    await startOnline();
    await screen.findByRole('region', { name: '題目與選項' });
    expect(stored()!.questionIds).not.toEqual(first.questionIds);
  });

  it('shows the verdict right after confirming, locks it, and lets questions be skipped and revisited', async () => {
    seed({ optionOrders: { 'law-114-01': [3, 2, 1, 0] } });
    renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    expect(screen.queryByText(/原選項/)).not.toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: '確認答案' });
    expect(confirm).toBeDisabled();
    chooseOption('選項 A');
    fireEvent.click(confirm);
    const verdict = within(questionRegion()).getByRole('status');
    expect(verdict).toHaveTextContent('答對了');
    expect(verdict).toHaveTextContent('正確答案：D・你的答案：D');
    expect(verdict).toHaveFocus();
    expect(screen.getByRole('region', { name: /原題第 1 題詳解/ })).toBeInTheDocument();
    expect(screen.getByText('使用者筆記')).toBeInTheDocument();
    expect(
      within(questionRegion())
        .getAllByRole('radio')
        .every(
          (radio) =>
            radio.getAttribute('aria-disabled') === 'true' ||
            radio.hasAttribute('data-disabled'),
        ),
    ).toBe(true);
    expect(stored()!.answers).toEqual({ 'law-114-01': { selected: 3, correct: true } });
    expect(within(questionRegion()).getAllByText(/原選項/).map(item => item.textContent)).toEqual([
      '（原選項 D）', '（原選項 C）', '（原選項 B）', '（原選項 A）',
    ]);
    expect(screen.getByText('選項 A').closest('label')).toHaveTextContent('D選項 A（原選項 A）');

    fireEvent.click(screen.getByRole('button', { name: /下一題/ }));
    await screen.findByLabelText('第 2 題，共 5 題');
    expect(screen.queryByText(/原選項/)).not.toBeInTheDocument();
    expect(router.push).toHaveBeenLastCalledWith(
      { pathname: '/practice/quiz', query: { q: 2 } },
      undefined,
      { shallow: true, scroll: false },
    );
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
    chooseOption('選項 B');
    fireEvent.click(screen.getByRole('button', { name: '跳過' }));
    await screen.findByLabelText('第 3 題，共 5 題');
    expect(router.snapshot.query).toEqual({ q: '3' });
    fireEvent.click(screen.getByRole('button', { name: /上一題/ }));
    await screen.findByLabelText('第 2 題，共 5 題');
    expect(optionRadio('選項 B')).toHaveAttribute('aria-checked', 'true');
    expect(optionRadio('選項 A')).toHaveAttribute('aria-checked', 'false');
    expect(stored()!.drafts).toEqual({ 'law-113-02': 1 });
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(within(questionRegion()).getByText('答錯了')).toBeInTheDocument();
    expect(
      within(questionRegion()).getByText(/正確答案：A・你的答案：B/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前往第 2 題（答錯）' })).toHaveAttribute(
      'href',
      '/practice/quiz?q=2',
    );
    expect(stored()!.answers['law-113-02']).toEqual({ selected: 1, correct: false });
  });

  it('clears a selected draft on a second click, persists it and still locks confirmed answers', async () => {
    seed({});
    const view = renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    chooseOption('選項 B');
    fireEvent.click(screen.getByText('選項 B').closest('label')!, { detail: 2 });
    expect(optionRadio('選項 B')).toHaveAttribute('aria-checked', 'false');
    expect(stored()!.drafts).toEqual({});
    expect(screen.getByRole('button', { name: '確認答案' })).toBeDisabled();
    view.unmount();
    renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    expect(optionRadio('選項 B')).toHaveAttribute('aria-checked', 'false');
    chooseOption('選項 A');
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    chooseOption('選項 A');
    expect(optionRadio('選項 A')).toHaveAttribute('aria-checked', 'true');
    expect(stored()!.answers['law-114-01']?.selected).toBe(0);
  });

  it('ignores repeated navigation clicks while allowing deliberate answer cancellation', async () => {
    seed({ answers: { 'law-114-01': { selected: 0, correct: true } } });
    renderAt('/practice/quiz?q=1');
    await screen.findByLabelText('第 1 題，共 5 題');
    fireEvent.click(screen.getByRole('button', { name: /下一題/ }), { detail: 2 });
    expect(router.push).not.toHaveBeenCalled();
    const repeat = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      detail: 2,
    });
    screen.getByRole('link', { name: '前往第 3 題' }).dispatchEvent(repeat);
    expect(repeat.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /下一題/ }), { detail: 1 });
    await screen.findByLabelText('第 2 題，共 5 題');
  });

  it('keeps struck-out options and difficult marks, and saves only what was submitted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    seed({});
    const view = renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    fireEvent.click(screen.getByRole('button', { name: '刪去選項 C' }));
    fireEvent.click(screen.getByRole('button', { name: '標記為難題' }));
    expect(appState.dispatch).toHaveBeenCalledWith({
      type: 'toggle-difficult',
      questionId: 'law-114-01',
    });
    chooseOption('選項 A');
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(stored()!.eliminated).toEqual({ 'law-114-01': [2] });

    view.unmount();
    reload();
    renderPage();
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(screen.getByRole('button', { name: '恢復選項 C' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await finishPractice();
    expect(confirm).toHaveBeenCalled();
    await screen.findByText('100% 正確率');
    // Answering itself records nothing; the submission is one 已作答紀錄 entry.
    const recordTypes = appState.dispatch.mock.calls.map(([action]) => action.type);
    expect(recordTypes).toEqual(['toggle-difficult', 'save-attempt']);
  });

  it('records a submitted set in 已作答紀錄 with the original options and the result page’s numbers', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seed({
      // Shown shuffled: 選項 A sits second on the screen, 選項 B first.
      optionOrders: { 'law-114-01': [1, 0, 2, 3] },
      answers: {
        'law-114-01': { selected: 1, correct: true },
        'law-113-02': { selected: 0, correct: false },
      },
      elapsedSeconds: { 'law-114-01': 30, 'law-113-02': 12 },
    });
    renderAt('/practice/quiz?q=1');
    await screen.findByLabelText('第 1 題，共 5 題');
    await finishPractice();
    await screen.findByText('67% 正確率');

    const saved = appState.dispatch.mock.calls.find(
      ([action]) => action.type === 'save-attempt',
    )![0];
    expect(saved.attempt).toMatchObject({
      mode: 'practice',
      subject: 'law',
      year: null,
      questionIds: lawQuestions.slice(0, 5).map((question) => question.id),
      // The shuffled second option is the paper's 選項 A; an unshuffled one stays as is.
      answers: { 'law-114-01': 0, 'law-113-02': 0, 'law-113-05': 0 },
      correctCount: 2,
      wrongCount: 1,
      unansweredCount: 2,
      elapsedSeconds: 42,
    });
    expect(saved.attempt.id).toMatch(/^attempt-/);
    expect(saved.results).toEqual({ 'law-114-01': true, 'law-113-02': false, 'law-113-05': true });
  });

  it('keeps an escape on an unavailable last question without recording a blank set', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seed({ questionIds: [...lawQuestions.slice(0, 4).map(question => question.id), 'law-114-99'] });
    renderAt('/practice/quiz?q=1');
    await screen.findByLabelText('第 1 題，共 5 題');
    await finishPractice(false);
    await screen.findByText('這次沒有作答任何題目');

    expect(
      appState.dispatch.mock.calls.some(([action]) => action.type === 'save-attempt'),
    ).toBe(false);
  });

  it('follows the question in the URL and keeps progress through a reload', async () => {
    seed({
      answers: { 'law-114-01': { selected: 0, correct: true } },
      elapsedSeconds: { 'law-114-01': 75 },
      currentIndex: 2,
    });
    const view = renderAt('/practice/quiz?q=3');
    await screen.findByLabelText('第 3 題，共 5 題');
    expect(screen.getByText('00:01:15')).toBeInTheDocument();

    act(() => router.link('/practice/quiz?q=1'));
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(within(questionRegion()).getByText('答對了')).toBeInTheDocument();
    view.unmount();

    reload();
    renderPage();
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(stored()!.currentIndex).toBe(0);
    act(() => router.link('/practice/quiz?q=99'));
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '1' }));
  });

  it('runs the clock only while the question is open, without saving the set every second', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    seed({});
    renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('00:00:03')).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    chooseOption('選項 C');
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('00:00:03')).toBeInTheDocument();
    expect(stored()!.elapsedSeconds).toEqual({ 'law-114-01': 3 });
  });

  it('saves the running clock when the page is hidden, and stops it until the page is back', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    seed({});
    renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    act(() => vi.advanceTimersByTime(4000));
    expect(stored()!.elapsedSeconds).toEqual({});
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(stored()!.elapsedSeconds).toEqual({ 'law-114-01': 4 });
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('00:00:04')).toBeInTheDocument();
    visibility.mockReturnValue('visible');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('00:00:06')).toBeInTheDocument();
    visibility.mockRestore();
  });

  it('asks before abandoning a set with progress, then clears it', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    seed({ drafts: { 'law-114-01': 2 } });
    renderAt('/practice/quiz?q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    fireEvent.click(screen.getByRole('button', { name: /重新選科／設定/ }));
    expect(confirm).toHaveBeenCalledWith(
      '確定要放棄目前的題組並回到設定嗎？作答進度會清除。',
    );
    expect(stored()).not.toBeNull();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /重新選科／設定/ }));
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    expect(stored()).toBeNull();
    await waitFor(() => expect(router.snapshot.asPath).toBe('/practice/quiz'));
  });
});

describe('PracticePage history', () => {
  async function startFiveQuestions() {
    renderAt();
    await openAdvanced();
    fireEvent.click(screen.getByRole('button', { name: /^5 題/ }));
    await startOnline();
    await screen.findByLabelText('第 1 題，共 5 題');
  }

  async function skipTo(number: number) {
    fireEvent.click(screen.getByRole('button', { name: '跳過' }));
    await screen.findByLabelText(`第 ${number} 題，共 5 題`);
  }

  it('steps back through questions, and Back from the first question leaves the page', async () => {
    await startFiveQuestions();
    await skipTo(2);
    await skipTo(3);
    await traverse(-1);
    await screen.findByLabelText('第 2 題，共 5 題');
    await traverse(-1);
    await screen.findByLabelText('第 1 題，共 5 題');
    await traverse(1);
    await screen.findByLabelText('第 2 題，共 5 題');
    await traverse(-2);
    expect(window.location.pathname).toBe('/elsewhere');
    expect(router.left).toBe(true);
  });

  it('rewinds an abandoned set, so Back from the setup and from a new set leaves the page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await startFiveQuestions();
    await skipTo(2);
    await skipTo(3);
    await skipTo(4);
    fireEvent.click(screen.getByRole('button', { name: /重新選科／設定/ }));
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    await settleHistory();
    expect(window.location.search).toBe('');

    await startOnline();
    await screen.findByLabelText('第 1 題，共 5 題');
    await traverse(-1);
    expect(window.location.pathname).toBe('/elsewhere');
  });

  it('rewinds after 交卷 → 重新選科／抽題 as well', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await startFiveQuestions();
    await skipTo(2);
    await finishPractice();
    await screen.findByText('100% 正確率');
    fireEvent.click(screen.getByRole('button', { name: /重新選科／抽題/ }));
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    await settleHistory();
    await traverse(-1);
    expect(window.location.pathname).toBe('/elsewhere');
  });

  it('keeps counting the set across a reload, so abandoning still leaves cleanly', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await startFiveQuestions();
    await skipTo(2);
    await skipTo(3);
    cleanup();
    reload();
    renderPage();
    await screen.findByLabelText('第 3 題，共 5 題');
    fireEvent.click(screen.getByRole('button', { name: /重新選科／設定/ }));
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    await settleHistory();
    await traverse(-1);
    expect(window.location.pathname).toBe('/elsewhere');
  });

  it("never rereads a gone set's question entry as a question of the current set", async () => {
    await startFiveQuestions();
    await skipTo(2);
    await skipTo(3);
    // Another tab starts a different set: this tab rewinds to the old set's first entry.
    writeFromOtherTab({
      ...makeSession({ id: 'other-set', currentIndex: 0 }),
      questionIds: lawQuestions.slice(20, 25).map((question) => question.id),
    });
    await settleHistory();
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(router.snapshot.query).toEqual({ q: '1' });
    // Forward reaches the old set's leftover ?q=2 entry: this set stays on question 1.
    await traverse(1);
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '1' }));
    expect(screen.getByLabelText('第 1 題，共 5 題')).toBeInTheDocument();
    // Back returns to the set's own first entry, then leaves.
    await traverse(-1);
    expect(screen.getByLabelText('第 1 題，共 5 題')).toBeInTheDocument();
    await traverse(-1);
    expect(window.location.pathname).toBe('/elsewhere');
  });
});

describe('PracticePage history across tabs', () => {
  it('rewinds once when another tab clears the set and starts a new one in quick succession', async () => {
    renderAt();
    await openAdvanced();
    fireEvent.click(screen.getByRole('button', { name: /^5 題/ }));
    await startOnline();
    await screen.findByLabelText('第 1 題，共 5 題');
    for (const number of [2, 3]) {
      fireEvent.click(screen.getByRole('button', { name: '跳過' }));
      await screen.findByLabelText(`第 ${number} 題，共 5 題`);
    }
    // Both arrive before the first rewind has finished.
    writeFromOtherTab(null);
    writeFromOtherTab({
      ...makeSession({ id: 'next-set', subject: 'env', currentIndex: 0 }),
      questionIds: envQuestions.slice(0, 4).map((question) => question.id),
    });
    await settleHistory();
    await screen.findByLabelText('第 1 題，共 4 題');
    expect(window.location.pathname).toBe('/practice/quiz');
    expect(router.snapshot.query).toEqual({ q: '1' });
    await traverse(-1);
    expect(window.location.pathname).toBe('/elsewhere');
  });
  it('stays in fresh subject selection when another tab starts a set after clearing', async () => {
    renderAt();
    await openAdvanced();
    fireEvent.click(screen.getByRole('button', { name: /^5 題/ }));
    await startOnline();
    await screen.findByLabelText('第 1 題，共 5 題');
    for (const number of [2, 3]) {
      fireEvent.click(screen.getByRole('button', { name: '跳過' }));
      await screen.findByLabelText(`第 ${number} 題，共 5 題`);
    }
    writeFromOtherTab(null);
    await settleHistory();
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    writeFromOtherTab({
      ...makeSession({ id: 'next-set', subject: 'env', currentIndex: 0 }),
      questionIds: envQuestions.slice(0, 4).map((question) => question.id),
    });
    await settleHistory();
    expect(screen.getByRole('region', { name: '每日抽題練習設定' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(stored()!.id).toBe('next-set');
    expect(window.location.pathname).toBe('/practice/quiz');
    expect(router.left).toBe(false);
    await traverse(-1);
    expect(window.location.pathname).toBe('/elsewhere');
  });
});

describe('PracticePage with another tab', () => {
  it("takes another tab's answers for the same set but keeps its own question", async () => {
    const session = seed({});
    renderAt('/practice/quiz?q=2');
    await screen.findByLabelText('第 2 題，共 5 題');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    writeFromOtherTab({
      ...session,
      answers: { 'law-114-01': { selected: 0, correct: true } },
      currentIndex: 0,
    });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '前往第 1 題' })).toHaveAttribute(
        'data-answered',
        'true',
      ),
    );
    expect(screen.getByLabelText('第 2 題，共 5 題')).toBeInTheDocument();
    // Only the other tab's own write: this tab does not echo the set back.
    expect(
      writes.mock.calls.filter(([key]) => key === PRACTICE_SESSION_STORAGE_KEY),
    ).toHaveLength(1);
    expect(stored()!.currentIndex).toBe(0);
  });

  it('counts the time on a question once when two windows show it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const session = seed({});
    renderAt('/practice/quiz?q=1');
    await screen.findByLabelText('第 1 題，共 5 題');
    act(() => vi.advanceTimersByTime(4000));
    // The other window, open alongside, saved 3 of those seconds itself.
    writeFromOtherTab({ ...session, elapsedSeconds: { 'law-114-01': 3 } });
    expect(screen.getByText('00:00:04')).toBeInTheDocument();
    chooseOption('選項 A');
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(stored()!.elapsedSeconds).toEqual({ 'law-114-01': 4 });
  });

  it('drops a kept result once another tab answers the set again', async () => {
    const session = seed({ answers: allCorrect, currentIndex: 4 });
    renderAt('/practice/quiz?q=5');
    await screen.findByLabelText('第 5 題，共 5 題');
    submitFromFooter();
    await screen.findByText('100% 正確率');
    writeFromOtherTab({
      ...session,
      answers: { 'law-114-01': { selected: 1, correct: false } },
      currentIndex: 0,
    });
    await waitFor(() =>
      expect(screen.queryByText('100% 正確率')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '1' }));
    expect(
      screen.queryByRole('button', { name: /重做這組題目/ }),
    ).not.toBeInTheDocument();
    expect(stored()!.answers).toEqual({ 'law-114-01': { selected: 1, correct: false } });
  });

  it("switches to another tab's new set and its subject, and to the setup when that tab clears it", async () => {
    seed({});
    renderAt('/practice/quiz?q=3');
    await screen.findByLabelText('第 3 題，共 5 題');
    writeFromOtherTab(
      makeSession({
        id: 'other-set',
        subject: 'env',
        questionIds: envQuestions.slice(0, 3).map((question) => question.id),
        currentIndex: 1,
      }),
    );
    await screen.findByLabelText('第 2 題，共 3 題');
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '2' }));

    writeFromOtherTab(null);
    await screen.findByRole('region', { name: '每日抽題練習設定' });
    expect(screen.getByRole('radio', { name: /建築環境控制/ })).not.toBeChecked();
    await waitFor(() => expect(router.snapshot.asPath).toBe('/practice/quiz'));
  });
});

describe('PracticePage result', () => {
  it('only offers completion after confirming the last question, including a one-question set and reload', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    seed({}, 1);
    const view = renderAt('/practice/quiz?q=1');
    await screen.findByLabelText('第 1 題，共 1 題');
    expect(screen.getByRole('button', { name: '確認答案' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '完成練習' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '跳過' })).not.toBeInTheDocument();
    chooseOption('選項 A');
    expect(screen.queryByRole('button', { name: '完成練習' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(within(questionRegion()).getByText('答對了')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '確認答案' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '完成練習' })).toBeInTheDocument();
    expect(appState.dispatch).not.toHaveBeenCalled();
    view.unmount();
    reload();
    const reloaded = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '完成練習' }));
    await screen.findByText('100% 正確率');
    expect(confirm).not.toHaveBeenCalled();
    expect(reloaded.container.firstElementChild).toHaveClass(styles.fullWidth);
    expect(appState.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'save-attempt' }));
  });

  it('submits with unanswered questions outside the accuracy and forgets the result on reload', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    seed({
      answers: {
        'law-113-05': { selected: 0, correct: true },
        'law-113-02': { selected: 2, correct: false },
      },
      drafts: { 'law-112-03': 1 },
      elapsedSeconds: { 'law-114-01': 20, 'law-113-02': 40 },
      currentIndex: 3,
    });
    const view = renderAt('/practice/quiz?q=4');
    await screen.findByLabelText('第 4 題，共 5 題');
    await finishPractice();
    expect(confirm).toHaveBeenCalledWith(
      '還有 3 題尚未確認答案，這些題目不會計入正確率。確定要完成練習嗎？',
    );
    expect(screen.queryByText('50% 正確率')).not.toBeInTheDocument();

    confirm.mockReturnValue(true);
    await finishPractice();
    expect(await screen.findByText('50% 正確率')).toBeInTheDocument();
    expect(
      screen.getByText(/共 5 題，作答 2 題，未作答 3 題不計入正確率/),
    ).toBeInTheDocument();
    const wrongReview = screen.getByRole('region', { name: '本次錯題整理' });
    expect(within(wrongReview).getAllByRole('article')).toHaveLength(1);
    expect(within(wrongReview).getByText('原題第 2 題')).toBeInTheDocument();
    expect(screen.getByText('00:01:00')).toBeInTheDocument();
    expect(router.snapshot.query).toEqual({ view: 'result' });
    expect(stored()).toMatchObject({
      questionIds: lawQuestions.slice(0, 5).map((question) => question.id),
      answers: {},
      drafts: {},
      elapsedSeconds: {},
    });

    fireEvent.click(screen.getByRole('button', { name: '本次考題預覽' }));
    expect(
      within(screen.getByRole('region', { name: '本次考題預覽' })).getAllByRole(
        'article',
      ),
    ).toHaveLength(5);

    view.unmount();
    reload();
    renderPage();
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(router.snapshot.query).toEqual({ q: '1' });
    expect(screen.queryByText('50% 正確率')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '確認答案' })).toBeDisabled();
  });

  it('keeps the result through Back and Forward until the set is answered again', async () => {
    seed({ answers: allCorrect, currentIndex: 4 });
    renderAt('/practice/quiz?q=5');
    await screen.findByLabelText('第 5 題，共 5 題');
    submitFromFooter();
    await screen.findByText('100% 正確率');

    await traverse(-1);
    await screen.findByLabelText('第 5 題，共 5 題');
    await traverse(1);
    expect(await screen.findByText('100% 正確率')).toBeInTheDocument();

    await traverse(-1);
    await screen.findByLabelText('第 5 題，共 5 題');
    chooseOption('選項 B');
    await traverse(1);
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '5' }));
    expect(screen.queryByText('100% 正確率')).not.toBeInTheDocument();
  });

  it('submits without asking once every question is answered, and can redo the same set', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    seed({ answers: allCorrect, currentIndex: 4 });
    renderAt('/practice/quiz?q=5');
    await screen.findByLabelText('第 5 題，共 5 題');
    submitFromFooter();
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByText('100% 正確率')).toBeInTheDocument();
    expect(
      screen.getByText('作答的題目全部答對，沒有需要檢討的題目。'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /重做這組題目/ }));
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(router.replace).toHaveBeenLastCalledWith(
      { pathname: '/practice/quiz', query: { q: 1 } },
      undefined,
      { shallow: true, scroll: false },
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(stored()!.questionIds).toEqual(
      lawQuestions.slice(0, 5).map((question) => question.id),
    );
    expect(screen.getByRole('button', { name: '確認答案' })).toBeDisabled();

    act(() => router.link('/practice/quiz?view=result'));
    await waitFor(() => expect(router.snapshot.query).toEqual({ q: '1' }));
  });

  it('reloads a result URL into the blank set from its first question', async () => {
    seed({ answers: allCorrect, currentIndex: 4 });
    const view = renderAt('/practice/quiz?q=5');
    await screen.findByLabelText('第 5 題，共 5 題');
    submitFromFooter();
    await screen.findByText('100% 正確率');
    view.unmount();

    reload();
    renderPage();
    await screen.findByLabelText('第 1 題，共 5 題');
    expect(router.snapshot.query).toEqual({ q: '1' });
  });

  it('shows the result at once, before the router has delivered its URL', async () => {
    seed({ answers: allCorrect, currentIndex: 4 });
    renderAt('/practice/quiz?q=5');
    await screen.findByLabelText('第 5 題，共 5 題');
    // Next resolves a shallow push later; here the URL never changes at all.
    router.push.mockImplementation(async () => true);
    submitFromFooter();
    expect(screen.getByText('100% 正確率')).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('100% 正確率')).toBeInTheDocument();
    act(() => router.link('/practice/quiz?view=result'));
    expect(await screen.findByText('100% 正確率')).toBeInTheDocument();
  });
});
