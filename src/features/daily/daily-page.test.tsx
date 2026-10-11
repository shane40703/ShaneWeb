import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import { ToastProvider } from '@/components/ui/ui';
import {
  DAILY_PRACTICE_STORAGE_KEY,
  createDailyPracticeSession,
  getTaipeiDateKey,
} from './daily-practice';
import { DailyPage } from './daily-page';

const appState = vi.hoisted(() => ({
  state: {
    difficultQuestionIds: [] as string[],
    notes: {} as Record<string, string>,
    noteImages: {} as Record<string, []>,
  },
  dispatch: vi.fn(),
  reportPersistence: vi.fn(),
}));

const sharedDiscussions = vi.hoisted(() => ({
  posts: [] as Array<Record<string, unknown>>,
}));
const bankState = vi.hoisted(() => ({ status: 'ready' as 'ready' | 'loading' | 'error' }));

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
    publish: vi.fn(),
    enabled: false,
  }),
}));

beforeEach(() => {
  bankState.status = 'ready';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.localStorage.clear();
  appState.dispatch.mockReset();
  appState.reportPersistence.mockReset();
  appState.state.notes = {};
  appState.state.noteImages = {};
  sharedDiscussions.posts = [];
});

afterEach(cleanup);

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

describe('DailyPage 1.63', () => {
  it('defaults to accessible normal practice with no battle, timer, or HP', async () => {
    renderDailyPage();
    expect(await screen.findByRole('radio', { name: /正常模式/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));
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
    expect(await screen.findByLabelText(/第 1 層 風之庭/)).toBeInTheDocument();
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
    expect(screen.getByLabelText(/第 1 層 建築法/)).toBeInTheDocument();
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
    expect(screen.getByLabelText(/第 2 層 公寓大廈管理條例/)).toBeInTheDocument();
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
    expect(screen.getByLabelText('公寓管家獸剩餘 6 / 6 點血量')).toBeInTheDocument();
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
    const session = seedSession();
    session.questionDeadlineMs = Date.now() + 40;
    session.hpUpdatedAtMs = Date.now();
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
    const view = renderDailyPage();
    expect(await screen.findByText('法規今日挑戰結束')).toBeInTheDocument();
    expect(screen.getByLabelText('每日挑戰戰敗')).toHaveTextContent('時間耗盡，遭魔王擊倒');
    view.unmount();
    renderDailyPage();
    expect(await screen.findByLabelText('每日挑戰戰敗')).toBeInTheDocument();
    expect(stored().status).toBe('failed');
  });

  it('normal mode completes even with all fifty wrong and lists them for review', async () => {
    seedSession(Array(49).fill(false), 'normal');
    renderDailyPage();
    await screen.findByText('選項 B');
    choose(false);
    expect(screen.queryByLabelText('每日挑戰戰敗')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(await screen.findByText('法規今日挑戰完成')).toBeInTheDocument();
    expect(screen.getByText('本次錯題整理')).toBeInTheDocument();
    expect(screen.queryByText('VICTORY!')).not.toBeInTheDocument();
    expect(stored().status).toBe('completed');
  });
  it('dies from cumulative HP depletion even while the sixty-second timer still has time', async () => {
    const session = seedSession([], 'adventure', 'practice', 0, .03);
    session.hpUpdatedAtMs = Date.now();
    session.questionDeadlineMs = Date.now() + 60_000;
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));
    renderDailyPage();
    expect(await screen.findByLabelText('每日挑戰戰敗')).toHaveTextContent('累積血量耗盡，建築師倒下了');
    expect(stored().failureReason).toBe('health');
    expect(stored().hp).toBe(0);
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
    fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));
    expect(await screen.findByRole('region', { name: '題目與選項' })).toBeInTheDocument();
  });
});
