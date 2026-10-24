import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import {
  QUIZ_PROGRESS_STORAGE_KEY,
  parseStoredQuizProgress,
  writeQuizProgress,
  type QuizProgressByQuestion,
} from './mock-exam-progress';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import { mockExamScope, type MockExamPaper } from './mock-exam';
import { MockExamPage } from './mock-exam-page';

// Next's shallow routing over jsdom's real history, so Back and Forward work.
const router = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const api = {
    snapshot: { asPath: '/practice/mock-exam', query: {} as Record<string, string> },
    show(url: string) {
      const parsed = new URL(url, 'http://localhost');
      api.snapshot = {
        asPath: `${parsed.pathname}${parsed.search}`,
        query: Object.fromEntries(parsed.searchParams),
      };
      listeners.forEach((listener) => listener());
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
  window.addEventListener('popstate', () =>
    api.show(`${window.location.pathname}${window.location.search}`),
  );
  return api;
});

vi.mock('next/router', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useRouter: () => ({
      ...useSyncExternalStore(router.subscribe, () => router.snapshot),
      pathname: '/practice/mock-exam',
      isReady: true,
      push: router.push,
      replace: router.replace,
    }),
  };
});

const appState = vi.hoisted(() => ({
  state: {
    attempts: [] as QuizAttempt[],
    difficultQuestionIds: [] as string[],
    notes: {} as Record<string, string>,
    noteImages: {} as Record<string, []>,
    readingPreferences: { questionFontSize: 18, optionFontSize: 18 },
  },
  hydrated: true,
  dispatch: vi.fn(),
  reportPersistence: vi.fn(),
}));
vi.mock('@/state/app-state', () => ({ useAppState: () => appState }));

vi.mock('@/lib/shared-discussions', () => ({
  useSharedDiscussions: () => ({ posts: [], loading: false, error: '' }),
  useDiscussionPublisher: () => ({ publish: vi.fn(), enabled: false }),
}));

function makeQuestion(
  subject: SubjectId,
  year: number,
  number: number,
  allCredit = false,
): Question {
  return {
    id: `${subject}-${year}-${String(number).padStart(2, '0')}`,
    subject,
    year,
    questionNumber: number,
    topic: '建築法',
    primaryCategory: '建築法',
    tags: [],
    relatedLaws: ['建築法'],
    text: `${year} 年第 ${number} 題`,
    content: [{ kind: 'text', text: `${year} 年第 ${number} 題題幹` }],
    options: [`${number}-甲`, `${number}-乙`, `${number}-丙`, `${number}-丁`],
    answerKey: allCredit ? { kind: 'all-credit' } : { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

// law 114: four regular questions and one 一律給分; law 113 and env 114 are smaller.
const bank = [
  ...[1, 2, 3, 4].map((number) => makeQuestion('law', 114, number)),
  makeQuestion('law', 114, 5, true),
  ...[1, 2, 3].map((number) => makeQuestion('law', 113, number)),
  ...[1, 2].map((number) => makeQuestion('env', 114, number)),
];
const papers: MockExamPaper[] = [
  { subject: 'law', year: 114, questionCount: 5, writtenCount: 0, firstWrittenId: null },
  { subject: 'law', year: 113, questionCount: 3, writtenCount: 0, firstWrittenId: null },
  {
    subject: 'env',
    year: 114,
    questionCount: 2,
    writtenCount: 3,
    firstWrittenId: 'env-114-written-01',
  },
];

const bankState = vi.hoisted(() => ({
  status: 'ready' as 'ready' | 'loading' | 'error',
}));
vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: (subjects: SubjectId[], years: number[] = []) => ({
    questions:
      bankState.status === 'ready'
        ? bank.filter(
            (question) =>
              subjects.includes(question.subject) && years.includes(question.year),
          )
        : [],
    status: bankState.status,
    retry: vi.fn(),
  }),
}));

function write(method: 'pushState' | 'replaceState', url: string) {
  window.history[method]({}, '', url);
  router.show(url);
}

beforeEach(() => {
  window.localStorage.clear();
  bankState.status = 'ready';
  appState.state.attempts = [];
  appState.state.difficultQuestionIds = [];
  appState.hydrated = true;
  appState.reportPersistence.mockReset();
  appState.dispatch.mockReset().mockImplementation((action) => {
    if (action.type === 'save-attempt') {
      appState.state.attempts = [action.attempt, ...appState.state.attempts];
    }
  });
  router.push.mockReset().mockImplementation(async (url: string) => {
    write('pushState', url);
    return true;
  });
  router.replace.mockReset().mockImplementation(async (url: string) => {
    write('replaceState', url);
    return true;
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderAt(url: string) {
  write('pushState', url);
  return render(
    <ToastProvider>
      <MockExamPage papers={papers} />
    </ToastProvider>,
  );
}

function storedDraft(subject: SubjectId = 'law', year = 114): QuizProgressByQuestion {
  return (
    parseStoredQuizProgress(window.localStorage.getItem(QUIZ_PROGRESS_STORAGE_KEY))[
      mockExamScope(subject, year)
    ] ?? {}
  );
}

function seedDraft(
  progress: QuizProgressByQuestion,
  subject: SubjectId = 'law',
  year = 114,
) {
  writeQuizProgress(mockExamScope(subject, year), progress);
}

function answered(selected: number, elapsedSeconds = 10) {
  return { selected, elapsedSeconds, startedAt: '2026-10-20T00:00:00.000Z' };
}

function option(text: string) {
  return screen.getByText(text).closest('label')!;
}

function optionRadio(text: string) {
  return option(text).querySelector('[role="radio"]')!;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('MockExamPage setup', () => {
  it('opens on the newest paper of the chosen subject and keeps a choice in the URL', async () => {
    renderAt('/practice/mock-exam?subject=law');

    const setup = await screen.findByRole('region', { name: '歷屆試題模擬考設定' });
    expect(within(setup).getByRole('radio', { name: /建築法規與實務/ })).toBeChecked();
    expect(within(setup).getByRole('radio', { name: /114 年/ })).toBeChecked();
    expect(setup).toHaveTextContent('選擇題 5 題，每題 1.25 分，滿分 100 分');
    expect(within(setup).getByRole('button', { name: '開始作答' })).toBeEnabled();

    fireEvent.click(within(setup).getByRole('radio', { name: /113 年/ }));
    expect(router.replace).toHaveBeenLastCalledWith(
      '/practice/mock-exam?subject=law&year=113',
      undefined,
      { shallow: true, scroll: false },
    );

    fireEvent.click(within(setup).getByRole('radio', { name: /建築環境控制/ }));
    await flush();
    // env has no 113 paper here, so the newest one is chosen.
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=env');
    expect(screen.getByRole('radio', { name: /114 年/ })).toBeChecked();
  });

  it('points papers with essays to 考古題討論版, which keeps them out of the score', async () => {
    renderAt('/practice/mock-exam?subject=env&year=114');

    const setup = await screen.findByRole('region', { name: '歷屆試題模擬考設定' });
    expect(setup).toHaveTextContent('另有申論題 3 題，不列入模擬考計分');
    expect(within(setup).getByRole('link', { name: /到考古題討論版閱讀/ })).toHaveAttribute(
      'href',
      '/exams?question=env-114-written-01',
    );
    expect(setup).toHaveTextContent('每題 1.5 分，滿分 60 分');
  });

  it('shows each year’s draft or last score, and resumes at the first unanswered question', async () => {
    seedDraft({ 'law-114-01': answered(0), 'law-114-02': answered(1) });
    appState.state.attempts = [
      {
        id: 'attempt-113',
        mode: 'paper',
        subject: 'law',
        year: 113,
        questionIds: ['law-113-01', 'law-113-02', 'law-113-03'],
        answers: { 'law-113-01': 0 },
        startedAt: '2026-10-01T00:00:00.000Z',
        submittedAt: '2026-10-01T01:00:00.000Z',
        elapsedSeconds: 60,
        correctCount: 1,
        wrongCount: 0,
        unansweredCount: 2,
      },
    ];
    renderAt('/practice/mock-exam?subject=law&year=113');

    const setup = await screen.findByRole('region', { name: '歷屆試題模擬考設定' });
    expect(
      within(setup)
        .getByRole('radio', { name: /114 年/ })
        .closest('label'),
    ).toHaveTextContent('作答中 2／5');
    expect(
      within(setup)
        .getByRole('radio', { name: /113 年/ })
        .closest('label'),
    ).toHaveTextContent('上次 1.25 分');
    expect(within(setup).getByRole('link', { name: /查看結果/ })).toHaveAttribute(
      'href',
      '/practice/mock-exam?subject=law&year=113&result=attempt-113',
    );

    fireEvent.click(within(setup).getByRole('radio', { name: /114 年/ }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '繼續作答（第 3 題）' }));
    await flush();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=3');
    expect(await screen.findByText('114 年第 3 題題幹')).toBeInTheDocument();
  });

  it('starts afresh on a paper that was only opened, never answered', async () => {
    seedDraft({
      'law-114-01': { elapsedSeconds: 90, startedAt: '2026-10-01T00:00:00.000Z' },
    });
    renderAt('/practice/mock-exam?subject=law&year=114');

    const setup = await screen.findByRole('region', { name: '歷屆試題模擬考設定' });
    expect(
      within(setup)
        .getByRole('radio', { name: /114 年/ })
        .closest('label'),
    ).not.toHaveTextContent('作答中');
    fireEvent.click(within(setup).getByRole('button', { name: '開始作答' }));
    await flush();

    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=1');
    expect(storedDraft()['law-114-01']?.elapsedSeconds).toBe(0);
  });

  it('restarts a paper only after confirming, from a fresh draft', async () => {
    seedDraft({ 'law-114-01': answered(0), 'law-114-02': answered(1) });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    renderAt('/practice/mock-exam?subject=law&year=114');

    fireEvent.click(await screen.findByRole('button', { name: /重新開始/ }));
    expect(confirm).toHaveBeenCalledWith('確定要清除這份試卷的作答進度並重新開始嗎？');
    expect(storedDraft()['law-114-02']?.selected).toBe(1);

    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: /重新開始/ }));
    await flush();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=1');
    expect(Object.keys(storedDraft())).toEqual(['law-114-01']);
    expect(storedDraft()['law-114-01']?.selected).toBeUndefined();
  });
});

describe('MockExamPage answering', () => {
  it('clears a selected answer on a quick second click and restores it as unanswered', async () => {
    seedDraft({ 'law-114-01': { ...answered(1, 14), eliminatedOptions: [2] } });
    const view = renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    fireEvent.click(option('1-乙'), { detail: 2 });
    expect(optionRadio('1-乙')).toHaveAttribute('aria-checked', 'false');
    expect(storedDraft()['law-114-01']).toMatchObject({ elapsedSeconds: 14, eliminatedOptions: [2] });
    expect(storedDraft()['law-114-01']?.selected).toBeUndefined();
    expect(screen.getByRole('link', { name: '前往第 1 題（未作答）' })).toHaveAttribute('aria-current', 'step');
    view.unmount();
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    await screen.findByRole('region', { name: '題目與選項' });
    expect(optionRadio('1-乙')).toHaveAttribute('aria-checked', 'false');
    expect(option('1-丙')).toHaveAttribute('data-eliminated', 'true');
  });

  it('starts at question 1 and keeps answers, strike-outs and the place through a reload', async () => {
    const { unmount } = renderAt('/practice/mock-exam?subject=law&year=114');
    fireEvent.click(await screen.findByRole('button', { name: '開始作答' }));
    await flush();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=1');

    fireEvent.click(option('1-乙'));
    expect(optionRadio('1-乙')).toHaveAttribute('aria-checked', 'true');
    // No verdict before 交卷: this is the exam, not a practice round.
    expect(screen.queryByText(/答對了|答錯了/)).not.toBeInTheDocument();
    expect(storedDraft()['law-114-01']?.selected).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /下一題/ }));
    await flush();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=2');
    fireEvent.click(screen.getByRole('button', { name: '刪去選項 C' }));
    expect(storedDraft()['law-114-02']?.eliminatedOptions).toEqual([2]);

    unmount();
    renderAt('/practice/mock-exam?subject=law&year=114&q=2');
    expect(await screen.findByText('114 年第 2 題題幹')).toBeInTheDocument();
    expect(option('2-丙')).toHaveAttribute('data-eliminated', 'true');
    const navigator = screen.getByRole('region', { name: '題號導覽' });
    // Answered or not is said, not only coloured.
    expect(
      within(navigator).getByRole('link', { name: '前往第 1 題（已作答）' }),
    ).toHaveAttribute('data-answered', 'true');
    expect(
      within(navigator).getByRole('link', { name: '前往第 2 題（未作答）' }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('sends a question link without a draft to that paper’s setup', async () => {
    renderAt('/practice/mock-exam?subject=law&year=113&q=2');
    await flush();

    expect(router.replace).toHaveBeenCalledWith(
      '/practice/mock-exam?subject=law&year=113',
      undefined,
      { shallow: true, scroll: false },
    );
    expect(await screen.findByRole('button', { name: '開始作答' })).toBeInTheDocument();
    expect(storedDraft('law', 113)).toEqual({});
  });

  it('never turns the focused 下一題 into 交卷, so a second key press cannot submit', async () => {
    seedDraft(
      Object.fromEntries(
        [1, 2, 3, 4, 5].map((number) => [`law-114-0${number}`, answered(0)]),
      ),
    );
    renderAt('/practice/mock-exam?subject=law&year=114&q=4');
    const question = await screen.findByRole('region', { name: '題目與選項' });
    const next = within(question.closest('article')!).getByRole('button', {
      name: /下一題/,
    });
    next.focus();
    fireEvent.click(next, { detail: 0 });
    await flush();

    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=5');
    const submit = within(question.closest('article')!).getByRole('button', {
      name: /^交卷$/,
    });
    expect(submit).not.toBe(next);
    expect(document.activeElement).not.toBe(submit);
  });

  it('moves an out-of-range question number to where the paper left off', async () => {
    seedDraft({ 'law-114-01': answered(0) });
    renderAt('/practice/mock-exam?subject=law&year=114&q=99');
    await flush();

    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=2');
  });

  it('counts time only while a question is shown and saves it when moving on', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    seedDraft({
      'law-114-01': { elapsedSeconds: 0, startedAt: '2026-10-20T00:00:00.000Z' },
    });
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    await flush();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByLabelText('作答時間 00:00:03')).toBeInTheDocument();
    // Not written every second.
    expect(storedDraft()['law-114-01']?.elapsedSeconds).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /下一題/ }));
    await flush();
    expect(storedDraft()['law-114-01']?.elapsedSeconds).toBe(3);
    expect(storedDraft()['law-114-02']).toBeDefined();
  });

  it('pauses in the background and saves the counted time when the page is hidden', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    seedDraft({
      'law-114-01': { elapsedSeconds: 0, startedAt: '2026-10-20T00:00:00.000Z' },
    });
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    await flush();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    visibility.mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Closing or switching away keeps the seconds counted so far.
    expect(storedDraft()['law-114-01']?.elapsedSeconds).toBe(2);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByLabelText('作答時間 00:00:02')).toBeInTheDocument();
    visibility.mockReturnValue('visible');
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByLabelText('作答時間 00:00:03')).toBeInTheDocument();
  });

  it('counts a question once when another window times it too', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    seedDraft({
      'law-114-01': { elapsedSeconds: 0, startedAt: '2026-10-20T00:00:00.000Z' },
    });
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // The other window, on the same question for the same 4 seconds, saves them first.
    seedDraft({
      'law-114-01': { elapsedSeconds: 4, startedAt: '2026-10-20T00:00:00.000Z' },
    });
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: QUIZ_PROGRESS_STORAGE_KEY }),
      );
    });
    expect(screen.getByLabelText('作答時間 00:00:04')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /下一題/ }));
    await flush();
    expect(storedDraft()['law-114-01']?.elapsedSeconds).toBe(4);
  });

  it('stamps the question answered, so drafts list this paper first', async () => {
    seedDraft({
      'law-114-01': { elapsedSeconds: 0, startedAt: '2026-10-01T00:00:00.000Z' },
    });
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    fireEvent.click(await screen.findByText('1-丙'));

    expect(storedDraft()['law-114-01']).toMatchObject({
      selected: 2,
      updatedAt: expect.any(String),
    });
    expect(storedDraft()['law-114-01']!.updatedAt! > '2026-10-01').toBe(true);
  });

  it('marks 難題 while answering, on the question and in the map', async () => {
    appState.state.difficultQuestionIds = ['law-114-03'];
    seedDraft({ 'law-114-01': answered(0) });
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    await screen.findByText('114 年第 1 題題幹');

    fireEvent.click(screen.getByRole('button', { name: '標記為難題' }));
    expect(appState.dispatch).toHaveBeenCalledWith({
      type: 'toggle-difficult',
      questionId: 'law-114-01',
    });
    const navigator = screen.getByRole('region', { name: '題號導覽' });
    expect(
      within(navigator).getByRole('link', { name: '前往第 3 題（未作答、已標記難題）' }),
    ).toHaveAttribute('data-difficult', 'true');
    const progress = screen.getByRole('region', { name: '作答進度' });
    expect(within(progress).getByText('難題').previousElementSibling).toHaveTextContent(
      '1',
    );
  });

  it('follows another tab: a submitted paper sends this one back to the setup', async () => {
    seedDraft({ 'law-114-01': answered(0) });
    renderAt('/practice/mock-exam?subject=law&year=114&q=1');
    expect(await screen.findByText('114 年第 1 題題幹')).toBeInTheDocument();

    writeQuizProgress(mockExamScope('law', 114), {});
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: QUIZ_PROGRESS_STORAGE_KEY }),
      );
    });
    await flush();

    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114');
    expect(screen.getByRole('button', { name: '開始作答' })).toBeInTheDocument();
  });
});

describe('MockExamPage submitting', () => {
  it.each(['loading', 'error'] as const)(
    'cannot submit while the paper is %s, and keeps the draft',
    async (status) => {
      bankState.status = status;
      seedDraft({ 'law-114-01': answered(0) });
      renderAt('/practice/mock-exam?subject=law&year=114&q=1');
      const sidebar = await screen.findByRole('complementary', { name: '試卷資訊' });

      expect(within(sidebar).getByRole('button', { name: /交卷/ })).toBeDisabled();
      fireEvent.click(within(sidebar).getByRole('button', { name: /交卷/ }));
      expect(appState.dispatch).not.toHaveBeenCalled();
      expect(storedDraft()['law-114-01']?.selected).toBe(0);
    },
  );

  it('counts the time on the question where 交卷 is pressed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    seedDraft({ 'law-114-05': { selected: 0, elapsedSeconds: 10, startedAt: 'a' } });
    renderAt('/practice/mock-exam?subject=law&year=114&q=5');
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    const sidebar = screen.getByRole('complementary', { name: '試卷資訊' });
    fireEvent.click(within(sidebar).getByRole('button', { name: /交卷/ }));

    expect(appState.dispatch.mock.calls[0][0].attempt.elapsedSeconds).toBe(14);
  });

  it('keeps answers in progress when 再考一次 is pressed on an old result', async () => {
    seedDraft({ 'law-114-01': answered(0), 'law-114-02': answered(1) });
    appState.state.attempts = [
      {
        id: 'attempt-old',
        mode: 'paper',
        subject: 'law',
        year: 114,
        questionIds: [
          'law-114-01',
          'law-114-02',
          'law-114-03',
          'law-114-04',
          'law-114-05',
        ],
        answers: {},
        startedAt: '2026-10-01T00:00:00.000Z',
        submittedAt: '2026-10-01T01:00:00.000Z',
        elapsedSeconds: 0,
        correctCount: 1,
        wrongCount: 0,
        unansweredCount: 4,
      },
    ];
    renderAt('/practice/mock-exam?subject=law&year=114&result=attempt-old');
    fireEvent.click(await screen.findByRole('button', { name: /再考一次/ }));
    await flush();

    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114');
    expect(
      screen.getByRole('button', { name: '繼續作答（第 3 題）' }),
    ).toBeInTheDocument();
    expect(storedDraft()['law-114-02']?.selected).toBe(1);
  });

  function seedAnswers() {
    seedDraft({
      'law-114-01': answered(0, 30),
      'law-114-02': answered(2, 20),
      'law-114-03': { elapsedSeconds: 5, startedAt: '2026-10-20T00:00:00.000Z' },
    });
  }

  it('asks before leaving questions unanswered, and cancelling keeps answering', async () => {
    seedAnswers();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/practice/mock-exam?subject=law&year=114&q=3');

    const sidebar = await screen.findByRole('complementary', { name: '試卷資訊' });
    fireEvent.click(within(sidebar).getByRole('button', { name: /交卷/ }));

    expect(confirm).toHaveBeenCalledWith(
      '還有 3 題未作答，其中 1 題一律給分仍會計分，其餘不給分。確定要交卷嗎？',
    );
    expect(appState.dispatch).not.toHaveBeenCalled();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114&q=3');
  });

  it('saves the paper to 已作答紀錄 with the official score, and shows it until deleted', async () => {
    seedAnswers();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/practice/mock-exam?subject=law&year=114');
    const historyLength = window.history.length;
    fireEvent.click(await screen.findByRole('button', { name: '繼續作答（第 3 題）' }));
    await flush();
    // Moving within the paper replaces the entry, so the exam is one stop in history.
    for (const expected of [4, 5]) {
      fireEvent.click(screen.getByRole('button', { name: /下一題/ }));
      await flush();
      expect(router.snapshot.asPath).toBe(
        `/practice/mock-exam?subject=law&year=114&q=${expected}`,
      );
    }
    expect(window.history.length).toBe(historyLength + 1);

    const question = await screen.findByRole('region', { name: '題目與選項' });
    fireEvent.click(
      within(question.closest('article')!).getByRole('button', { name: /^交卷$/ }),
    );
    await flush();

    expect(appState.dispatch).toHaveBeenCalledTimes(1);
    const [{ attempt, results }] = appState.dispatch.mock.calls[0];
    expect(attempt).toMatchObject({
      mode: 'paper',
      subject: 'law',
      year: 114,
      answers: { 'law-114-01': 0, 'law-114-02': 2 },
      elapsedSeconds: 55,
      // 一律給分 counts even unanswered, as on the original 考古題討論版.
      correctCount: 2,
      wrongCount: 1,
      unansweredCount: 2,
    });
    expect(results).toEqual({
      'law-114-01': true,
      'law-114-02': false,
      'law-114-03': false,
      'law-114-04': false,
      'law-114-05': true,
    });
    expect(storedDraft()).toEqual({});
    expect(router.snapshot.asPath).toBe(
      `/practice/mock-exam?subject=law&year=114&result=${encodeURIComponent(attempt.id)}`,
    );

    const result = screen.getByRole('region', { name: /法規 114 年模擬考結果/ });
    expect(result).toHaveTextContent('2.50 分／滿分 100 分');
    expect(result).toHaveTextContent(
      '共 5 題，作答 2 題，未作答 3 題；其中 1 題一律給分，計入答對，其餘不給分。',
    );
    // 一律給分 is in 答對, blanks are all the questions without an answer.
    expect(within(result).getByText('答對').nextElementSibling).toHaveTextContent('2');
    expect(within(result).getByText('未作答').nextElementSibling).toHaveTextContent('3');
    expect(screen.getByRole('tab', { name: '錯題統計結果' })).toBeInTheDocument();
    const map = screen.getByRole('complementary', { name: '作答結果題號導覽' });
    expect(within(map).getByRole('link', { name: /查看第 2 題結果/ })).toHaveAttribute(
      'data-wrong',
      'true',
    );
    // A blank 一律給分 question scored, so it is marked like the other correct ones.
    expect(within(map).getByRole('link', { name: /查看第 5 題結果/ })).toHaveAttribute(
      'data-answered',
      'true',
    );
    expect(
      within(map).getByRole('link', { name: /查看第 3 題結果/ }),
    ).not.toHaveAttribute('data-answered');

    // The result took the exam's place: Back lands on the paper's setup.
    expect(window.history.length).toBe(historyLength + 1);
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await flush();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114');
    expect(screen.getByRole('button', { name: '開始作答' })).toBeInTheDocument();
  });

  it('retakes a submitted paper from question 1', async () => {
    appState.state.attempts = [
      {
        id: 'attempt-1',
        mode: 'paper',
        subject: 'law',
        year: 113,
        questionIds: ['law-113-01', 'law-113-02', 'law-113-03'],
        answers: { 'law-113-01': 0, 'law-113-02': 0, 'law-113-03': 1 },
        startedAt: '2026-10-01T00:00:00.000Z',
        submittedAt: '2026-10-01T01:00:00.000Z',
        elapsedSeconds: 60,
        correctCount: 2,
        wrongCount: 1,
        unansweredCount: 0,
      },
    ];
    renderAt('/practice/mock-exam?subject=law&year=113&result=attempt-1');

    expect(await screen.findByText('2.50 分／滿分 100 分')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /再考一次/ }));
    await flush();

    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=113&q=1');
    expect(Object.keys(storedDraft('law', 113))).toEqual(['law-113-01']);
  });

  it('says so when the result is no longer saved', async () => {
    renderAt('/practice/mock-exam?subject=law&year=114&result=gone');

    expect(
      await screen.findByText('找不到這次的作答結果，可能已從已作答紀錄清除。'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '回到選卷' }));
    await flush();
    expect(router.snapshot.asPath).toBe('/practice/mock-exam?subject=law&year=114');
  });
});
