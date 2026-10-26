import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fillRichEditor, selectRichEditor } from '@/test/rich-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptReview, countWrongAttemptsThrough } from '@/components/attempt-review';
import { CloudSyncProvider } from '@/components/cloud-sync-provider';
import { ToastProvider } from '@/components/ui/ui';
import type { QuizAttempt } from '@/lib/types';
import { AppStateProvider, useAppState } from '@/state/app-state';

const questions = [
  {
    id: 'law-114-01',
    year: 114,
    questionNumber: 1,
    text: '第一題',
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted' as const, options: [1] },
    explanation: '官方題目詳解',
  },
  {
    id: 'law-114-02',
    year: 114,
    questionNumber: 2,
    text: '第二題',
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted' as const, options: [2] },
  },
];

const attempt: QuizAttempt = {
  id: 'attempt-1',
  mode: 'paper',
  subject: 'law',
  year: 114,
  questionIds: questions.map((question) => question.id),
  answers: {
    'law-114-01': 1,
    'law-114-02': 0,
  },
  startedAt: '2026-07-25T00:00:00.000Z',
  submittedAt: '2026-07-25T00:01:00.000Z',
  elapsedSeconds: 60,
  correctCount: 1,
  wrongCount: 1,
  unansweredCount: 0,
};

function DiscussionProbe() {
  const { state } = useAppState();
  return (
    <output aria-label="共享詳解狀態" data-count={state.discussionPosts.length}>
      {state.discussionPosts.map((post) => post.content).join('、')}
    </output>
  );
}

describe('AttemptReview', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '');
  });

  it('counts repeated wrong answers through the selected attempt, mock exams and practice alike', () => {
    const current = { ...attempt, id: 'attempt-2', submittedAt: '2026-07-26T00:01:00.000Z' };
    const later = { ...attempt, id: 'attempt-3', submittedAt: '2026-07-27T00:01:00.000Z' };
    const practice = { ...attempt, id: 'attempt-practice', mode: 'practice' as const, year: null };
    expect(countWrongAttemptsThrough(current, questions[1], [attempt, current, later, practice]))
      .toBe(3);
  });

  it('renders every answer and loads its complete options only after opening', async () => {
    render(
      <ToastProvider>
        <AppStateProvider>
          <CloudSyncProvider>
            <AttemptReview
              attempt={attempt}
              questions={questions}
            />
          </CloudSyncProvider>
        </AppStateProvider>
      </ToastProvider>,
    );

    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    expect(screen.getByText('第一題')).toBeInTheDocument();
    expect(screen.getByText('第二題')).toBeInTheDocument();
    expect(screen.queryByText('1. 114 年・第 1 題')).not.toBeInTheDocument();
    expect(screen.getByText('114 年・第 1 題')).toBeInTheDocument();
    expect(screen.getByText(/你的答案：B/)).toHaveTextContent('標準答案：B');
    expect(screen.getByText(/你的答案：A/)).toHaveTextContent('標準答案：C');
    expect(screen.queryByText('選項 D')).not.toBeInTheDocument();
    for (const summary of screen.getAllByText('檢視完整選項與筆記')) fireEvent.click(summary);
    await waitFor(() => expect(screen.getAllByText('選項 D')).toHaveLength(2));
    expect(screen.queryByText('官方題目詳解')).not.toBeInTheDocument();
    expect(screen.queryByText('查看題目')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看第 1 題' }),
    ).not.toBeInTheDocument();
    const discussionButtons = screen.getAllByRole('button', {
      name: '顯示詳解與討論',
    });
    fireEvent.click(discussionButtons[0]);
    expect(screen.getByText('官方題目詳解')).toBeInTheDocument();
    fireEvent.click(discussionButtons[1]);
    expect(screen.getByText('尚未有詳解或討論。')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '第 1 題使用者筆記' }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole('region', { name: '第 1 題使用者筆記' })
        .closest('details'),
    ).toHaveTextContent('檢視完整選項與筆記');
  });

  it('publishes a review note through the discussion data source', async () => {
    render(
      <ToastProvider>
        <AppStateProvider>
          <CloudSyncProvider>
            <AttemptReview attempt={attempt} questions={questions.slice(0, 1)} />
            <DiscussionProbe />
          </CloudSyncProvider>
        </AppStateProvider>
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('檢視完整選項與筆記'));
    fillRichEditor(await screen.findByLabelText('第 1 題筆記內容'), '從對答案分享的詳解');
    fireEvent.click(screen.getByRole('button', { name: /分享到考古題討論版/ }));

    expect(await screen.findByLabelText('共享詳解狀態')).toHaveTextContent(
      '從對答案分享的詳解',
    );

    fillRichEditor(screen.getByLabelText('第 1 題筆記內容'), '修正後的詳解');
    fireEvent.click(screen.getByRole('button', { name: /分享到考古題討論版/ }));

    const result = await screen.findByLabelText('共享詳解狀態');
    expect(result).toHaveTextContent('修正後的詳解');
    expect(result).not.toHaveTextContent('從對答案分享的詳解');
    expect(result).toHaveAttribute('data-count', '1');
  });

  it('formats review notes live without a separate preview', async () => {
    render(
      <ToastProvider>
        <AppStateProvider>
          <CloudSyncProvider>
            <AttemptReview attempt={attempt} questions={questions.slice(0, 1)} />
          </CloudSyncProvider>
        </AppStateProvider>
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('檢視完整選項與筆記'));
    const editor = await screen.findByLabelText('第 1 題筆記內容');
    fillRichEditor(editor, '建築物最大容許給水壓力');
    selectRichEditor(editor, 3, 7);
    fireEvent.click(
      screen.getByRole('button', { name: '切換第 1 題選取文字的粗體格式' }),
    );

    expect(editor.querySelector('strong')).toHaveTextContent('最大容許');
    expect(editor).not.toHaveTextContent('**');
    expect(screen.queryByRole('region', { name: '第 1 題筆記格式預覽' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '第 1 題文字顏色' })).toBeInTheDocument();
  });
});
