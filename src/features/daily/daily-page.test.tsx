import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import { ToastProvider } from '@/components/ui/ui';
import {
  DAILY_COMPLETION_STORAGE_KEY,
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
  Array.from({ length: 60 }, (_, index) => question(subject, index + 1)),
);

vi.mock('@/state/app-state', () => ({
  useAppState: () => appState,
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: (subjectIds: SubjectId[]) => ({
    questions: allQuestions.filter((item) => subjectIds.includes(item.subject)),
    status: 'ready',
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

describe('DailyPage', () => {
  it('creates an independent fifty-question run for one selected subject', async () => {
    renderDailyPage();

    expect(await screen.findByText('建築師的六層試煉')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /建築環境控制/ }));
    expect(screen.getByText('已選 環控・今日 50 題')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));

    const statistics = await screen.findByLabelText('每日練習統計');
    expect(within(screen.getByRole('complementary', { name: '挑戰資訊' })).getByLabelText('每日練習統計')).toBe(statistics);
    await waitFor(() => expect(within(statistics).getByText('/ 50')).toBeInTheDocument());
    expect(screen.getByLabelText('環控關卡進度')).toBeInTheDocument();
    expect(screen.queryByText('114 年')).not.toBeInTheDocument();
    expect(screen.getByText('測試分類')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '標記為難題' })).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: /本題剩餘 \d+ 秒/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /結界：發動 10 秒防護罩/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/第 1 層 磚造巷口/)).toBeInTheDocument();

    const eliminate = screen.getByRole('button', { name: '刪去選項 A' });
    fireEvent.click(eliminate);
    expect(eliminate).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows a completed subject to be challenged again during testing', async () => {
    window.localStorage.setItem(
      DAILY_COMPLETION_STORAGE_KEY,
      JSON.stringify({
        date: getTaipeiDateKey(),
        subjects: ['law'],
        results: {
          law: { answered: 50, correct: 44, status: 'completed' },
        },
      }),
    );

    renderDailyPage();

    const law = await screen.findByRole('radio', { name: /建築法規與實務/ });
    expect(law).toBeEnabled();
    expect(law).toBeChecked();
    expect(screen.getByText(/今日上次完成・答對 44 \/ 50 題，可再次挑戰/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));
    expect(await screen.findByLabelText('法規關卡進度')).toBeInTheDocument();
  });

  it('lists wrong questions under the completed subject summary', async () => {
    const session = createDailyPracticeSession(
      [question('law', 1)],
      ['law'],
      getTaipeiDateKey(),
    );
    session.currentIndex = 1;
    session.status = 'completed';
    session.answers[session.questionIds[0]] = { selected: 1, correct: false };
    session.optionOrders[session.questionIds[0]] = [0, 1, 2, 3];
    window.localStorage.setItem(
      DAILY_PRACTICE_STORAGE_KEY,
      JSON.stringify(session),
    );
    window.localStorage.setItem(
      DAILY_COMPLETION_STORAGE_KEY,
      JSON.stringify({ date: getTaipeiDateKey(), subjects: ['law'] }),
    );

    renderDailyPage();

    expect(await screen.findByText('法規今日挑戰完成')).toBeInTheDocument();
    expect(screen.getByLabelText('六層挑戰勝利')).toBeInTheDocument();
    expect(screen.getByText('VICTORY!')).toBeInTheDocument();
    expect(screen.getByLabelText(/砌縫咕嚕剩餘 0/)).toBeInTheDocument();
    expect(screen.getByText('本次錯題整理')).toBeInTheDocument();
    expect(screen.getByText('law 第 1 題')).toBeInTheDocument();
    expect(screen.getByText('正確答案：A')).toBeInTheDocument();
  });

  it('does not show a separate success banner after a correct answer', async () => {
    const session = createDailyPracticeSession(
      [question('law', 1)],
      ['law'],
      getTaipeiDateKey(),
    );
    session.optionOrders[session.questionIds[0]] = [0, 1, 2, 3];
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    fireEvent.click((await screen.findByText('選項 A')).closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(screen.queryByText('答對了，繼續前進！')).not.toBeInTheDocument();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    expect(screen.getByText('連擊 1 / 3')).toBeInTheDocument();
    expect(screen.getByText('正確答案：A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一題' })).toBeInTheDocument();
  });

  it('restores one life after three consecutive correct answers', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 4 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.questionIds.forEach((id) => {
      session.optionOrders[id] = [0, 1, 2, 3];
    });
    session.currentIndex = 3;
    session.answers[session.questionIds[0]] = { selected: 1, correct: false };
    session.answers[session.questionIds[1]] = { selected: 0, correct: true };
    session.answers[session.questionIds[2]] = { selected: 0, correct: true };
    session.unreviewedWrongIds = [session.questionIds[0]];
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    fireEvent.click((await screen.findByText('選項 A')).closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(screen.getByText('血量 +1')).toBeInTheDocument();
    expect(screen.getByText('目前血量 3 / 3')).toBeInTheDocument();
    expect(screen.getByLabelText('建築師剩餘 3 / 3 點血量')).toBeInTheDocument();
  });

  it('lets a full-health streak relic remove one incorrect option', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 4 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.questionIds.forEach((id) => {
      session.optionOrders[id] = [0, 1, 2, 3];
    });
    session.currentIndex = 3;
    session.questionIds.slice(0, 3).forEach((id) => {
      session.answers[id] = { selected: 0, correct: true };
    });
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    const relic = await screen.findByRole('button', { name: /破除：自動刪除一個錯誤選項，持有 1 個/ });
    fireEvent.click(relic);
    expect(relic).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '恢復選項 B' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /結界：發動 10 秒防護罩/ })).toBeDisabled();
  });

  it('lets the ten-second barrier block a boss counterattack', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 6 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.questionIds.forEach((id) => {
      session.optionOrders[id] = [0, 1, 2, 3];
    });
    session.currentIndex = 5;
    session.questionIds.slice(0, 5).forEach((id) => {
      session.answers[id] = { selected: 0, correct: true };
    });
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    const barrier = await screen.findByRole('button', {
      name: /結界：發動 10 秒防護罩.*持有 1 個/,
    });
    fireEvent.click(barrier);
    fireEvent.click(screen.getByText('選項 B').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));

    expect(screen.getByText('結界擋下反擊，本題未扣血')).toBeInTheDocument();
    expect(screen.getByLabelText('建築師剩餘 3 / 3 點血量')).toBeInTheDocument();
    expect(screen.getByText('BLOCK!')).toBeInTheDocument();
    expect(screen.getByLabelText(/第 2 層 鋼構工地/)).toHaveAttribute('data-blocked', 'true');
  });

  it('shows a flawless stage clear and awards a relic', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 5 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.questionIds.forEach((id) => {
      session.optionOrders[id] = [0, 1, 2, 3];
    });
    session.currentIndex = 4;
    session.questionIds.slice(0, 4).forEach((id) => {
      session.answers[id] = { selected: 0, correct: true };
    });
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    fireEvent.click((await screen.findByText('選項 A')).closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(screen.getByText('魔王擊破！')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(await screen.findByRole('heading', { name: '無傷通關！' })).toBeInTheDocument();
    expect(screen.getByText('PERFECT CLEAR・寶具 +1')).toBeInTheDocument();
    expect(screen.getByLabelText('本層評級 S')).toBeInTheDocument();
  });

  it('ends the run immediately when the timer expires', async () => {
    const session = createDailyPracticeSession(
      [question('law', 1)],
      ['law'],
      getTaipeiDateKey(),
    );
    session.optionOrders[session.questionIds[0]] = [0, 1, 2, 3];
    session.questionDeadlineMs = Date.now() + 60;
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    expect(await screen.findByText('法規今日挑戰結束', {}, { timeout: 1500 })).toBeInTheDocument();
    expect(screen.getByText(/完成 1 題，答對 0 題、答錯 1 題/)).toBeInTheDocument();
    expect(screen.getByLabelText('每日挑戰戰敗')).toHaveTextContent('時間耗盡，遭魔王擊倒');
    expect(screen.getByLabelText('建築師剩餘 0 / 3 點血量')).toBeInTheDocument();
  });

  it('ends the current run when the third first-stage life is lost', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 5 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.questionIds.forEach((id) => {
      session.optionOrders[id] = [0, 1, 2, 3];
    });
    session.currentIndex = 2;
    session.questionIds.slice(0, 2).forEach((id) => {
      session.answers[id] = { selected: 1, correct: false };
    });
    session.unreviewedWrongIds = session.questionIds.slice(0, 2);
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    expect(await screen.findByLabelText('建築師剩餘 1 / 3 點血量')).toBeInTheDocument();
    fireEvent.click((await screen.findByText('選項 B')).closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));
    expect(await screen.findByText('法規今日挑戰結束')).toBeInTheDocument();
    expect(screen.getByText(/完成 3 題，答對 0 題、答錯 3 題/)).toBeInTheDocument();
    expect(screen.getByLabelText('每日挑戰戰敗')).toHaveTextContent('耐久耗盡，建築師倒下了');
    expect(screen.getByLabelText('建築師剩餘 0 / 3 點血量')).toBeInTheDocument();
    expect(screen.getByLabelText(/第 1 層 磚造巷口/)).toHaveAttribute('data-result', 'wrong');
  });

  it('restores the failed stage and defeat scene at a stage boundary', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 6 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.currentIndex = 5;
    session.status = 'failed';
    session.answers = Object.fromEntries(session.questionIds.slice(0, 5).map((id, index) => [
      id, { selected: index % 2 === 0 && index !== 4 ? 0 : 1, correct: index % 2 === 0 && index !== 4 },
    ]));
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    expect(await screen.findByLabelText('每日挑戰戰敗')).toBeInTheDocument();
    expect(screen.getByLabelText(/第 1 層 磚造巷口/)).toHaveAttribute('data-failed', 'true');
    expect(screen.getByLabelText('建築師剩餘 0 / 3 點血量')).toBeInTheDocument();
    expect(screen.queryByLabelText(/第 2 層 鋼構工地/)).not.toBeInTheDocument();
    const failedStage = within(screen.getByLabelText('法規關卡進度')).getAllByRole('listitem')[0];
    expect(failedStage).toHaveAttribute('data-failed', 'true');
    expect(failedStage).not.toHaveAttribute('data-complete');
    expect(screen.queryByText('COUNTER!')).not.toBeInTheDocument();
  });

  it('does not end when the third total mistake is only the first mistake of a new level', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 6 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    session.questionIds.forEach((id) => {
      session.optionOrders[id] = [0, 1, 2, 3];
    });
    session.currentIndex = 5;
    session.questionIds.slice(0, 5).forEach((id, index) => {
      session.answers[id] = { selected: index < 2 ? 1 : 0, correct: index >= 2 };
    });
    session.unreviewedWrongIds = [];
    session.reviewedWrongIds = [];
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    expect(await screen.findByLabelText('建築師剩餘 3 / 3 點血量')).toBeInTheDocument();
    fireEvent.click(screen.getByText('選項 B').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '確認答案' }));

    expect(screen.queryByText('法規今日挑戰結束')).not.toBeInTheDocument();
    expect(screen.getByLabelText('建築師剩餘 2 / 3 點血量')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一題' })).toBeInTheDocument();
  });

  it('offers the user note editor during wrong-answer review', async () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 5 }, (_, index) => question('law', index + 1)),
      ['law'],
      getTaipeiDateKey(),
    );
    const wrongId = session.questionIds[0];
    session.currentIndex = 5;
    session.status = 'review';
    session.answers[wrongId] = { selected: 1, correct: false };
    session.unreviewedWrongIds = [wrongId];
    session.optionOrders[wrongId] = [0, 1, 2, 3];
    sharedDiscussions.posts = [{
      id: 'shared-explanation',
      questionId: wrongId,
      type: 'explanation',
      content: '這是共享詳解內容',
      images: [],
      createdAt: '2026-10-09T00:00:00.000Z',
      likes: 0,
      replies: [],
      reported: false,
    }];
    window.localStorage.setItem(DAILY_PRACTICE_STORAGE_KEY, JSON.stringify(session));

    renderDailyPage();

    expect(await screen.findByRole('region', { name: /使用者筆記/ })).toBeInTheDocument();
    expect(screen.getByText('114 年')).toBeInTheDocument();
    expect(screen.getByText('測試分類')).toBeInTheDocument();
    expect(screen.getByText('這是共享詳解內容')).toBeInTheDocument();
  });
});
