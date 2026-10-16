import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import { ToastProvider } from '@/components/ui/ui';
import {
  DAILY_PRACTICE_STORAGE_KEY,
  DAILY_PAPER_STORAGE_KEY,
  createDailyPracticeSession,
  getTaipeiDateKey,
} from './daily-practice';
import { DailyPage } from './daily-page';

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

const sharedDiscussions = vi.hoisted(() => ({
  posts: [] as Array<Record<string, unknown>>,
  publish: vi.fn(),
}));
const bankState = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'loading' | 'error' }));
const paperDownload = vi.hoisted(() => vi.fn());
vi.mock('./daily-paper-pdf', () => ({ downloadDailyPaperPdf: paperDownload }));

function question(subject: SubjectId, number: number): Question {
  return {
    id: `${subject}-114-${String(number).padStart(2, '0')}`,
    subject,
    year: 114,
    questionNumber: number,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `${subject} 第 ${number} 題`,
    content: [{ kind: 'text', text: `${subject} 第 ${number} 題` }],
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

const allQuestions = (['law', 'env'] as const).flatMap((subject) =>
  Array.from({ length: 90 }, (_, index) => question(subject, index + 1)),
);

vi.mock('@/state/app-state', () => ({
  useAppState: () => appState,
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: (subjectIds: SubjectId[]) => ({
    questions: allQuestions.filter((item) => subjectIds.includes(item.subject)),
    status: bankState.status,
    retry: vi.fn(),
  }),
}));

vi.mock('@/lib/shared-discussions', () => ({
  useSharedDiscussions: () => ({
    posts: sharedDiscussions.posts,
    loading: false,
    error: '',
  }),
  useDiscussionPublisher: () => ({
    publish: sharedDiscussions.publish,
    enabled: false,
  }),
}));

beforeEach(() => {
  bankState.status = 'ready';
  paperDownload.mockReset().mockResolvedValue(undefined);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.localStorage.clear();
  appState.dispatch.mockReset();
  appState.reportPersistence.mockReset();
  appState.state.notes = {};
  appState.state.noteImages = {};
  appState.state.readingPreferences = { questionFontSize: 18, optionFontSize: 18 };
  sharedDiscussions.posts = [];
  sharedDiscussions.publish.mockReset();
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderDailyPage() {
  return render(
    <ToastProvider>
      <DailyPage />
    </ToastProvider>,
  );
}

function seedSession(results: boolean[] = [], mode: 'adventure' | 'normal' = 'adventure', status: 'practice' | 'completed' | 'failed' | 'review' = 'practice', currentIndex = results.length, hp = 100) {
  const session = createDailyPracticeSession(allQuestions, ['law'], getTaipeiDateKey(), () => .5, mode);
  session.questionIds = allQuestions.filter(q => q.subject === 'law').slice(0, mode === 'normal' ? 50 : 74).map(q => q.id);
  session.optionOrders = Object.fromEntries(session.questionIds.map(id => [id, [0,1,2,3]]));
  session.answers = Object.fromEntries(results.map((correct, i) => [session.questionIds[i], { selected: correct ? 0 : 1, correct }]));
  session.currentIndex = currentIndex;
  session.status = status;
  session.hp = hp;
  session.unreviewedWrongIds = session.questionIds.filter(id => session.answers[id] && !session.answers[id].correct);
  window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
  return session;
}
function stored() { return JSON.parse(window.localStorage.getItem(DAILY_PRACTICE_STORAGE_KEY)!); }
function choose(correct: boolean) {
  fireEvent.click(screen.getByText(correct ? '選項 A' : '選項 B').closest('label')!);
  fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
}

describe('DailyPage', () => {
  it('locks online-first normal practice per subject through replays, subject switching, reload and later paper download', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = renderDailyPage();
    fireEvent.click(await screen.findByRole('button', { name: '線上作答' }));
    await screen.findByRole('region', { name: '題目與選項' });
    const law = stored();
    choose(true);
    expect(Object.keys(stored().answers)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /重新選科／模式/ }));
    await screen.findByRole('region', { name: '每日練習設定' });
    fireEvent.click(screen.getByRole('radio', { name: /建築環境控制/ }));
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    await screen.findByRole('region', { name: '題目與選項' });
    const env = stored();
    expect(env.questionIds.every((id: string) => id.startsWith('env-'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /重新選科／模式/ }));
    fireEvent.click(await screen.findByRole('radio', { name: /建築法規與實務/ }));
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    await screen.findByRole('region', { name: '題目與選項' });
    expect(stored()).toMatchObject({ questionIds: law.questionIds, optionOrders: law.optionOrders, answers: {}, currentIndex: 0 });
    const record = JSON.parse(window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY)!);
    expect(record.sets.law.questionIds).toEqual(law.questionIds);
    expect(record.sets.env.questionIds).toEqual(env.questionIds);
    expect(record.sets.law.answers).toEqual({});
    view.unmount();
    renderDailyPage();
    await screen.findByRole('region', { name: '題目與選項' });
    fireEvent.click(screen.getByRole('button', { name: /重新選科／模式/ }));
    fireEvent.click(await screen.findByRole('button', { name: '製作每日練習紙本檔案' }));
    await waitFor(() => expect(paperDownload).toHaveBeenCalledTimes(1));
    expect(paperDownload.mock.calls[0][0].questions.map((question: Question) => question.id)).toEqual(law.questionIds);
    expect(paperDownload.mock.calls[0][0].questions[0].options).toEqual(
      law.optionOrders[law.questionIds[0]].map((index: number) => allQuestions.find(q => q.id === law.questionIds[0])!.options[index]),
    );
    expect(window.localStorage.getItem(DAILY_PRACTICE_STORAGE_KEY)).toBeNull();
  });

  it('adopts existing normal progress as the daily set without resetting saved answers', async () => {
    const active = seedSession([false, true], 'normal');
    const oldPaper = createDailyPracticeSession(allQuestions, ['env'], getTaipeiDateKey(), () => .7, 'normal');
    window.localStorage.setItem(DAILY_PAPER_STORAGE_KEY, JSON.stringify(oldPaper));
    renderDailyPage();
    await screen.findByRole('region', { name: '題目與選項' });
    expect(stored()).toMatchObject({ questionIds: active.questionIds, optionOrders: active.optionOrders, answers: active.answers, currentIndex: 2 });
    const record = JSON.parse(window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY)!);
    expect(record.sets.law).toMatchObject({ questionIds: active.questionIds, optionOrders: active.optionOrders, answers: {}, currentIndex: 0 });
    expect(record.sets.env.questionIds).toEqual(oldPaper.questionIds);
  });

  it('always redraws adventures without changing the fixed normal assignment', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const random = vi.spyOn(Math, 'random').mockReturnValue(.2);
    try {
      renderDailyPage();
      fireEvent.click(await screen.findByRole('button', { name: '線上作答' }));
      await screen.findByRole('region', { name: '題目與選項' });
      const fixed = window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY);
      fireEvent.click(screen.getByRole('button', { name: /重新選科／模式/ }));
      fireEvent.click(await screen.findByRole('radio', { name: /以闖關模式進行/ }));
      fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));
      await screen.findByRole('region', { name: '題目與選項' });
      const first = stored();
      expect(first.questionIds).toHaveLength(74);
      fireEvent.click(screen.getByRole('button', { name: /重新選科／模式/ }));
      await screen.findByRole('region', { name: '每日練習設定' });
      random.mockReturnValue(.8);
      fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));
      await screen.findByRole('region', { name: '題目與選項' });
      expect(stored().questionIds).not.toEqual(first.questionIds);
      expect(window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY)).toBe(fixed);
    } finally { random.mockRestore(); }
  });

  it.each([
    ['normal', 'practice'], ['adventure', 'practice'], ['adventure', 'review'],
  ] as const)('hides paper tools and the full preview during %s %s', async (mode, status) => {
    seedSession([], mode, status);
    renderDailyPage();
    await screen.findByLabelText('每日練習進度與關卡');
    expect(screen.queryByRole('region', { name: '當日試題工具' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '當日考題預覽工具' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '當日考題預覽' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '列印／下載 PDF' })).not.toBeInTheDocument();
  });

  it.each([
    ['normal', 'completed'], ['adventure', 'completed'], ['adventure', 'failed'],
  ] as const)('shows the complete preview below results and wrong answers after %s %s', async (mode, status) => {
    const session = status === 'failed'
      ? seedSession(Array(7).fill(false), mode, status, 7, 0)
      : seedSession(Array(50).fill(true), mode, status);
    renderDailyPage();
    const panel = await screen.findByRole('region', { name: '當日考題預覽工具' });
    await act(async () => {});
    const wrongAnswers = screen.getByRole('region', { name: '本次錯題整理' });
    expect(wrongAnswers.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.parentElement!.lastElementChild).toBe(panel);
    expect(screen.queryByRole('button', { name: '列印／下載 PDF' })).not.toBeInTheDocument();
    const before = window.localStorage.getItem(DAILY_PRACTICE_STORAGE_KEY);
    fireEvent.click(within(panel).getByRole('button', { name: '當日考題預覽' }));
    const preview = within(panel).getByRole('region', { name: '當日考題預覽' });
    expect(within(preview).getAllByRole('article')).toHaveLength(session.questionIds.length);
    expect(within(preview).queryByText('正確答案')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: '收合當日考題' }));
    expect(window.localStorage.getItem(DAILY_PRACTICE_STORAGE_KEY)).toBe(before);
    expect(paperDownload).not.toHaveBeenCalled();
  });

  it('places paper and online actions at the bottom, after mode and subject selection', async () => {
    renderDailyPage();
    const setup = await screen.findByRole('region', { name: '每日練習設定' });
    const footer = setup.querySelector('footer')!;
    const subjects = within(setup).getByRole('group', { name: '選擇今日科目' });
    expect(setup.lastElementChild).toBe(footer);
    expect(subjects.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(footer).getByRole('button', { name: '製作每日練習紙本檔案' })).toBeEnabled();
    expect(within(footer).getByRole('button', { name: '線上作答' })).toBeEnabled();
    expect(within(screen.getByRole('group', { name: '選擇進行方式' })).queryByRole('button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /以闖關模式進行/ }));
    expect(within(footer).queryByRole('button', { name: '製作每日練習紙本檔案' })).not.toBeInTheDocument();
    expect(within(footer).queryByRole('button', { name: '線上作答' })).not.toBeInTheDocument();
    expect(within(footer).getByRole('button', { name: /建立今日挑戰/ })).toBeEnabled();
  });

  it('makes a persistent paper directly from setup without starting online practice, then reuses it online', async () => {
    const view = renderDailyPage();
    await screen.findByRole('radio', { name: /正常模式/ });
    expect(screen.queryByRole('button', { name: '建立今日挑戰' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /建築環境控制/ }));
    fireEvent.click(screen.getByRole('button', { name: '製作每日練習紙本檔案' }));
    await waitFor(() => expect(paperDownload).toHaveBeenCalledTimes(1));
    const first = paperDownload.mock.calls[0][0];
    expect(first.subjectName).toBe('建築環境控制');
    expect(first.questions).toHaveLength(50);
    expect(window.localStorage.getItem(DAILY_PRACTICE_STORAGE_KEY)).toBeNull();
    expect(appState.dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: '題目與選項' })).not.toBeInTheDocument();
    const savedPaper = JSON.parse(window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY)!).sets.env;
    view.unmount();
    renderDailyPage();
    await screen.findByRole('radio', { name: /正常模式/ });
    fireEvent.click(screen.getByRole('radio', { name: /建築環境控制/ }));
    fireEvent.click(screen.getByRole('button', { name: '製作每日練習紙本檔案' }));
    await waitFor(() => expect(paperDownload).toHaveBeenCalledTimes(2));
    expect(paperDownload.mock.calls[1][0]).toEqual(first);
    await waitFor(() => expect(screen.getByRole('button', { name: '線上作答' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    await screen.findByRole('region', { name: '題目與選項' });
    expect(stored().questionIds).toEqual(savedPaper.questionIds);
    expect(stored().optionOrders).toEqual(savedPaper.optionOrders);
    expect(stored().answers).toEqual({});
  });

  it('keeps the same paper on a failed download and retry, without creating answer records', async () => {
    paperDownload.mockRejectedValueOnce(new Error('測試下載失敗')).mockResolvedValue(undefined);
    renderDailyPage();
    fireEvent.click(await screen.findByRole('button', { name: '製作每日練習紙本檔案' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('測試下載失敗');
    const saved = window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY);
    fireEvent.click(screen.getByRole('button', { name: '製作每日練習紙本檔案' }));
    await waitFor(() => expect(paperDownload).toHaveBeenCalledTimes(2));
    expect(window.localStorage.getItem(DAILY_PAPER_STORAGE_KEY)).toBe(saved);
    expect(window.localStorage.getItem(DAILY_PRACTICE_STORAGE_KEY)).toBeNull();
    expect(paperDownload.mock.calls[0][0]).toEqual(paperDownload.mock.calls[1][0]);
    expect(appState.dispatch).not.toHaveBeenCalled();
  });
  it('removes the setup hero and detailed rules while preserving mode and subject choices', async () => {
    renderDailyPage();
    expect(await screen.findByRole('region', { name: '每日練習設定' })).toBeInTheDocument();
    expect(screen.queryByText('建築師的六層試煉')).not.toBeInTheDocument();
    expect(screen.queryByText('DAILY CHALLENGE')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('每日練習規則')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /以闖關模式進行/ }));
    expect(screen.queryByLabelText('每日練習規則')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '選擇今日科目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /建立今日挑戰/ })).toBeEnabled();
  });

  it.each(['normal', 'adventure'] as const)('does not duplicate the global reading controls in %s practice', async (mode) => {
    seedSession([], mode);
    appState.state.readingPreferences = { questionFontSize: 22, optionFontSize: 16 };
    renderDailyPage();
    await screen.findByRole('region', { name: '題目與選項' });
    expect(screen.queryByText('字體大小', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: '題目字體' })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: '選項字體' })).not.toBeInTheDocument();
    expect(appState.state.readingPreferences).toEqual({ questionFontSize: 22, optionFontSize: 16 });
    expect(stored().answers).toEqual({});
    expect(stored().currentIndex).toBe(0);
  });

  it('defaults to accessible normal practice with no battle, timer, or HP', async () => {
    renderDailyPage();
    expect(await screen.findByRole('radio', { name: /正常模式/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    expect(await screen.findByRole('region', { name: '題目與選項' })).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('建築師勇者')).not.toBeInTheDocument();
    expect(stored()).toMatchObject({ mode: 'normal' });
    expect(stored().questionIds).toHaveLength(50);
    const selected = screen.getAllByRole('radio')[0];
    fireEvent.click(selected);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(screen.getAllByText(/正確答案：/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '下一題' })).toBeInTheDocument();
  });

  it('creates an independent subject-specific adventure with reserves', async () => {
    renderDailyPage();
    fireEvent.click(await screen.findByRole('radio', { name: /以闖關模式進行/ }));
    fireEvent.click(screen.getByRole('radio', { name: /建築環境控制/ }));
    fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));
    expect(await screen.findByLabelText(/第 1 層 入口/)).toBeInTheDocument();
    expect(screen.getByLabelText('旋風精靈', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: /本題剩餘/ })).toBeInTheDocument();
    expect(stored().questionIds).toHaveLength(74);
    expect(stored().questionIds.every((id: string) => id.startsWith('env-'))).toBe(true);
    expect(within(screen.getByLabelText('環控關卡進度')).getAllByRole('listitem')).toHaveLength(6);
  });

  it('does not damage or advance a living boss after five attempts containing a mistake', async () => {
    seedSession([false,true,true,true], 'adventure', 'practice', 4, 80);
    renderDailyPage();
    await screen.findByText('選項 A');
    choose(true);
    expect(screen.getByLabelText('建照印章獸剩餘 1 / 5 點血量')).toBeInTheDocument();
    expect(screen.getByText('血量 +15')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(screen.queryByRole('heading', { name: '完成錯題檢討再前進' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/第 1 層 入口/)).toBeInTheDocument();
    expect(stored().currentIndex).toBe(5);
    expect(stored().status).toBe('practice');
  });

  it('keeps stage damage, wrong count and HP after correct healing', async () => {
    seedSession([false,true,true], 'adventure', 'practice', 3, 60);
    renderDailyPage();
    await screen.findByText('選項 A');
    choose(true);
    expect(screen.getByText('3 COMBO!・連擊必殺')).toBeInTheDocument();
    expect(screen.getByText('血量 +15・寶具 +1')).toBeInTheDocument();
    expect(screen.getByLabelText('建照印章獸剩餘 2 / 5 點血量')).toBeInTheDocument();
    expect(screen.getByLabelText('建築師剩餘 75 / 100 點血量')).toBeInTheDocument();
    expect(screen.getByText(/本層錯 1\/7/)).toBeInTheDocument();
    expect(stored().hp).toBeGreaterThan(74);
    expect(stored().hp).toBeLessThanOrEqual(75);
  });

  it('carries HP to the next stage and restores a fresh guard without a refill', async () => {
    seedSession([true,true,true,true], 'adventure', 'practice', 4, 42);
    renderDailyPage();
    await screen.findByText('選項 A');
    choose(true);
    expect(screen.getByText('魔王擊破！')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(await screen.findByRole('heading', { name: '無傷通關！' })).toBeInTheDocument();
    expect(screen.getByText('PERFECT CLEAR・寶具 +1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '繼續闖關' }));
    expect(screen.getByRole('region', { name: '換層過場' })).toBeInTheDocument();
    expect(stored().status).toBe('review');
    expect(stored().questionDeadlineMs).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: '略過過場' }));
    expect(screen.getByLabelText(/第 2 層 迴廊/)).toBeInTheDocument();
    expect(stored().hp).toBeGreaterThan(56);
    expect(stored().hp).toBeLessThanOrEqual(57);
    await waitFor(() => expect(screen.getByRole('button', { name: '架設防禦：每關一次，蓄力亮紅時完美格擋' })).toBeEnabled());
  });

  it('reviews only after the boss is already dead and keeps notes and shared explanations', async () => {
    seedSession([false,true,true,true,true,true], 'adventure', 'review', 6, 80);
    sharedDiscussions.posts = [{
      id: 'explanation', questionId: 'law-114-01', type: 'explanation',
      content: '這是共享詳解內容', images: [], createdAt: '', likes: 0, replies: [], reported: false,
    }];
    renderDailyPage();
    expect(await screen.findByRole('heading', { name: '完成錯題檢討再前進' })).toBeInTheDocument();
    expect(screen.getByLabelText('建照印章獸剩餘 0 / 5 點血量')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /使用者筆記/ })).toBeInTheDocument();
    expect(screen.getByText('這是共享詳解內容')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '繼續闖關' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '我已理解錯誤原因' }));
    fireEvent.click(screen.getByRole('button', { name: '繼續闖關' }));
    fireEvent.click(screen.getByRole('button', { name: '略過過場' }));
    expect(screen.getByLabelText('公寓管家獸剩餘 6 / 6 點血量')).toBeInTheDocument();
  });

  it('automatically finishes a paused transition and starts the next stage timer only afterwards', async () => {
    seedSession(Array(5).fill(true), 'adventure', 'review', 5, 63);
    renderDailyPage();
    await screen.findByRole('heading', { name: '無傷通關！' });
    fireEvent.click(screen.getByRole('button', { name: '繼續闖關' }));
    expect(screen.getByRole('heading', { name: '前往第 2 層・迴廊' })).toBeInTheDocument();
    const transition = screen.getByRole('region', { name: '換層過場' });
    expect(transition.closest('[class*="battleColumn"]')).not.toBeNull();
    expect(transition.closest('[class*="questionArea"]')).toBeNull();
    expect(screen.getByRole('heading', { name: '無傷通關！' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '正在前往下一層…' })).toBeDisabled();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '確認答案' })).not.toBeInTheDocument();
    expect(stored()).toMatchObject({ status: 'review', hp: 63, currentIndex: 5 });
    expect(stored().questionDeadlineMs).toBeUndefined();
    expect(await screen.findByLabelText(/第 2 層 迴廊/, {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(stored().questionDeadlineMs).toBeGreaterThan(Date.now()));
    expect(stored().hp).toBe(63);
    expect(screen.queryByRole('region', { name: '換層過場' })).not.toBeInTheDocument();
  });

  it('restores paused review if reloaded during a transition instead of consuming next-stage time', async () => {
    seedSession(Array(5).fill(true), 'adventure', 'review', 5, 48);
    const view = renderDailyPage();
    await screen.findByRole('heading', { name: '無傷通關！' });
    fireEvent.click(screen.getByRole('button', { name: '繼續闖關' }));
    expect(screen.getByRole('region', { name: '換層過場' })).toBeInTheDocument();
    view.unmount();
    renderDailyPage();
    expect(await screen.findByRole('heading', { name: '無傷通關！' })).toBeInTheDocument();
    expect(stored()).toMatchObject({ status: 'review', hp: 48 });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it.each(['normal', 'adventure'] as const)('allows saved notes and shared explanations after a correct %s answer', async mode => {
    seedSession([], mode);
    appState.state.notes['law-114-01'] = '既有筆記';
    renderDailyPage();
    await screen.findByText('選項 A');
    expect(screen.queryByRole('textbox', { name: '第 1 題筆記內容' })).not.toBeInTheDocument();
    choose(true);
    const editor = screen.getByRole('textbox', { name: '第 1 題筆記內容' });
    expect(editor).toHaveValue('既有筆記');
    fireEvent.change(editor, { target: { value: '**答對也要記錄觀念**' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存筆記' }));
    expect(appState.dispatch).toHaveBeenCalledWith({
      type: 'save-note', questionId: 'law-114-01', content: '**答對也要記錄觀念**', images: [],
    });
    fireEvent.click(screen.getByRole('button', { name: '分享至詳解與討論' }));
    await waitFor(() => expect(sharedDiscussions.publish).toHaveBeenCalledWith('explanation', '**答對也要記錄觀念**', []));
    expect(stored().questionDeadlineMs).toBeUndefined();
    expect(stored().answers['law-114-01'].correct).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    choose(true);
    expect(screen.getByRole('textbox', { name: '第 2 題筆記內容' })).toHaveValue('');
  });

  it('does not add a seventh-stage transition after the final review', async () => {
    seedSession(Array(50).fill(true), 'adventure', 'review', 50, 75);
    renderDailyPage();
    await screen.findByRole('heading', { name: '無傷通關！' });
    fireEvent.click(screen.getByRole('button', { name: '繼續闖關' }));
    expect(screen.queryByRole('region', { name: '換層過場' })).not.toBeInTheDocument();
    expect(stored().status).toBe('completed');
  });

  it('ends at the seventh first-stage mistake and displays death with a living boss', async () => {
    seedSession(Array(6).fill(false));
    renderDailyPage();
    await screen.findByText('選項 B');
    choose(false);
    expect(await screen.findByText('法規今日挑戰結束')).toBeInTheDocument();
    expect(screen.getByLabelText('每日挑戰戰敗')).toHaveTextContent('達到本層錯題上限，遭魔王擊倒');
    expect(screen.getByLabelText('建築師剩餘 0 / 100 點血量')).toBeInTheDocument();
    expect(screen.getByLabelText('建照印章獸剩餘 5 / 5 點血量')).toBeInTheDocument();
    expect(stored().failureReason).toBe('mistakes');
    expect(screen.getByRole('button', { name: '當日考題預覽' })).toBeEnabled();
  });

  it('perfect guard protects HP but still counts a mistake and persists consumption', async () => {
    const session = seedSession([], 'adventure', 'practice', 0, 80);
    session.questionDeadlineMs = Date.now() + 54_000;
    session.hpUpdatedAtMs = Date.now();
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
    renderDailyPage();
    const guard = await screen.findByRole('button', { name: '架設防禦：每關一次，蓄力亮紅時完美格擋' });
    fireEvent.click(guard);
    expect(screen.getByText('完美格擋！延長 5 秒，防護 3 秒')).toBeInTheDocument();
    choose(false);
    expect(screen.getByText('完美格擋擋下反擊，錯題次數仍 +1')).toBeInTheDocument();
    expect(screen.getByText('BLOCK!')).toBeInTheDocument();
    expect(stored().hp).toBeGreaterThan(79);
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(guard).toBeDisabled();
    expect(stored().guardUses[session.questionIds[0]]).toBe('perfect');
    expect(screen.getByText(/本層錯 1\/7/)).toBeInTheDocument();
  });

  it('stops immediately at timeout and preserves defeat after reload', async () => {
    vi.useFakeTimers();
    try {
      const session = seedSession();
      session.questionDeadlineMs = Date.now() + 40;
      session.hpUpdatedAtMs = Date.now();
      window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
      const view = renderDailyPage();
      await act(async () => {});
      await act(async () => { await vi.advanceTimersByTimeAsync(80); });
      expect(screen.getByText('法規今日挑戰結束')).toBeInTheDocument();
      expect(screen.getByLabelText('每日挑戰戰敗')).toHaveTextContent('時間耗盡，遭魔王擊倒');
      view.unmount();
      renderDailyPage();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByLabelText('每日挑戰戰敗')).toBeInTheDocument();
      expect(stored().status).toBe('failed');
    } finally { vi.useRealTimers(); }
  });

  it('normal mode completes even with all fifty wrong and lists them for review', async () => {
    seedSession(Array(49).fill(false), 'normal');
    renderDailyPage();
    await screen.findByText('選項 B');
    expect(screen.queryByRole('button', { name: '當日考題預覽' })).not.toBeInTheDocument();
    choose(false);
    expect(screen.queryByLabelText('每日挑戰戰敗')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(await screen.findByText('法規今日挑戰完成')).toBeInTheDocument();
    expect(screen.getByText('本次錯題整理')).toBeInTheDocument();
    expect(screen.queryByText('VICTORY!')).not.toBeInTheDocument();
    expect(stored().status).toBe('completed');
    expect(screen.getByRole('button', { name: '當日考題預覽' })).toBeEnabled();
  });
  it('dies from cumulative HP depletion even while the sixty-second timer still has time', async () => {
    vi.useFakeTimers();
    try {
      const session = seedSession([], 'adventure', 'practice', 0, .03);
      session.hpUpdatedAtMs = Date.now();
      session.questionDeadlineMs = Date.now() + 60_000;
      window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
      renderDailyPage();
      await act(async () => {});
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(screen.getByLabelText('每日挑戰戰敗')).toHaveTextContent('累積血量耗盡，建築師倒下了');
      expect(stored().failureReason).toBe('health');
      expect(stored().hp).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('does not restart time or drain HP while a cached question is still loading', async () => {
    const session = seedSession([], 'adventure', 'practice', 0, 70);
    session.hpUpdatedAtMs = Date.now();
    session.questionDeadlineMs = Date.now() + 50_000;
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
    bankState.status = 'loading';
    const view = renderDailyPage();
    expect(await screen.findByText('正在載入今日題目…')).toBeInTheDocument();
    await waitFor(() => expect(stored().questionDeadlineMs).toBeUndefined());
    const hp = stored().hp;
    const remaining = stored().questionRemainingMs;
    expect(remaining).toBeGreaterThan(49_000);
    expect(remaining).toBeLessThanOrEqual(50_000);
    bankState.status = 'ready';
    view.rerender(<ToastProvider><DailyPage /></ToastProvider>);
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    await waitFor(() => expect(stored().questionDeadlineMs).toBeGreaterThan(Date.now()));
    expect(stored().hp).toBe(hp);
    expect(stored().questionDeadlineMs - Date.now()).toBeLessThanOrEqual(remaining);
  });

  it('allows repeated testing and preserves legacy progress in normal mode', async () => {
    const session = seedSession([false,true], 'normal');
    delete session.rulesVersion; delete session.mode;
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
    renderDailyPage();
    expect(await screen.findByText(/舊版進度已保留於正常模式/)).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(Object.keys(stored().answers)).toHaveLength(2);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /重新選科／模式/ }));
    expect(await screen.findByRole('radio', { name: /正常模式/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '線上作答' }));
    expect(await screen.findByRole('region', { name: '題目與選項' })).toBeInTheDocument();
  });
});
