import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptReview } from '@/components/attempt-review';
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
    path: '/questions/law/114/01',
  },
  {
    id: 'law-114-02',
    year: 114,
    questionNumber: 2,
    text: '第二題',
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted' as const, options: [2] },
    path: '/questions/law/114/02',
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

  it('renders every answer and its complete options', () => {
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
    expect(screen.getAllByText('選項 D')).toHaveLength(2);
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

    fireEvent.change(screen.getByLabelText('第 1 題筆記內容'), {
      target: { value: '從對答案分享的詳解' },
    });
    fireEvent.click(screen.getByRole('button', { name: /分享至詳解與討論/ }));

    expect(await screen.findByLabelText('共享詳解狀態')).toHaveTextContent(
      '從對答案分享的詳解',
    );

    fireEvent.change(screen.getByLabelText('第 1 題筆記內容'), {
      target: { value: '修正後的詳解' },
    });
    fireEvent.click(screen.getByRole('button', { name: /分享至詳解與討論/ }));

    const result = await screen.findByLabelText('共享詳解狀態');
    expect(result).toHaveTextContent('修正後的詳解');
    expect(result).not.toHaveTextContent('從對答案分享的詳解');
    expect(result).toHaveAttribute('data-count', '1');
  });

  it('formats review notes without a separate preview', () => {
    render(
      <ToastProvider>
        <AppStateProvider>
          <CloudSyncProvider>
            <AttemptReview attempt={attempt} questions={questions.slice(0, 1)} />
          </CloudSyncProvider>
        </AppStateProvider>
      </ToastProvider>,
    );

    const editor = screen.getByLabelText<HTMLTextAreaElement>('第 1 題筆記內容');
    fireEvent.change(editor, { target: { value: '建築物最大容許給水壓力' } });
    editor.setSelectionRange(3, 7);
    fireEvent.click(
      screen.getByRole('button', { name: '切換第 1 題選取文字的粗體格式' }),
    );

    expect(editor).toHaveValue('建築物**最大容許**給水壓力');
    expect(screen.queryByRole('region', { name: '第 1 題筆記格式預覽' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切換第 1 題選取文字的紅字格式' })).toBeInTheDocument();
  });
});
