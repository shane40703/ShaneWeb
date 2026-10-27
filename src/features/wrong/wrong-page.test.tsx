import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { WrongPage } from '@/features/wrong/wrong-page';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { DiscussionPost, Question, QuizAttempt, SubjectId } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';
import { PRACTICE_SESSION_STORAGE_KEY } from '@/features/practice/practice-session';

const router = vi.hoisted(() => ({ push: vi.fn(async () => true) }));
vi.mock('next/router', () => ({ useRouter: () => router }));

function question(
  id: string,
  subject: SubjectId,
  year: number,
  questionNumber: number,
): Question {
  return {
    id,
    subject,
    year,
    questionNumber,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `${id} 題幹`,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: [`${id} A`, `${id} B`, `${id} C`, `${id} D`],
    answerKey: { kind: 'accepted', options: [1] },
    explanation: `${id} 詳解`,
    source: { kind: 'sample' },
  };
}

const lawQuestion = question('law-114-01', 'law', 114, 1);
const olderLawQuestion = question('law-113-03', 'law', 113, 3);
const environmentQuestion = question('env-113-02', 'env', 113, 2);

function attempt(
  id: string,
  subject: SubjectId,
  year: number,
  submittedAt: string,
  answers: Record<string, number>,
): QuizAttempt {
  return {
    id,
    mode: 'paper',
    subject,
    year,
    questionIds: Object.keys(answers),
    answers,
    startedAt: submittedAt,
    submittedAt,
    elapsedSeconds: 90,
    correctCount: 0,
    wrongCount: Object.keys(answers).length,
    unansweredCount: 0,
  };
}

const attempts = [
  attempt('law-1', 'law', 114, '2026-08-01T00:00:00.000Z', {
    [lawQuestion.id]: 0,
  }),
  attempt('law-2', 'law', 114, '2026-08-02T00:00:00.000Z', {
    [lawQuestion.id]: 0,
  }),
  attempt('law-older', 'law', 113, '2026-08-02T12:00:00.000Z', {
    [olderLawQuestion.id]: 0,
  }),
  attempt('env-1', 'env', 113, '2026-08-03T00:00:00.000Z', {
    [environmentQuestion.id]: 3,
  }),
];

function renderPage(sourceAttempts = attempts, discussionPosts: DiscussionPost[] = []) {
  const state = createDefaultState();
  state.attempts = sourceAttempts;
  state.discussionPosts = discussionPosts;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return render(
    <ToastProvider>
      <AppStateProvider>
        <WrongPage
          attempts={sourceAttempts}
          questions={[lawQuestion, olderLawQuestion, environmentQuestion]}
          questionBankStatuses={{ law: 'ready', env: 'ready' }}
        />
      </AppStateProvider>
    </ToastProvider>,
  );
}

afterEach(cleanup);

describe('WrongPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.push.mockClear();
  });

  it('starts all distinct wrong questions of the active subject, including other years', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '練習本科目常錯題目' }));
    fireEvent.click(await screen.findByRole('button', { name: '開始練習（2 題）' }));
    const saved = JSON.parse(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)!);
    expect(saved.questionIds).toEqual(['law-114-01', 'law-113-03']);
    expect(saved.reviewSource).toBe('wrong');
    expect(router.push).toHaveBeenCalledWith('/practice/quiz?q=1');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).attempts).toHaveLength(attempts.length);
  });

  it('groups saved mistakes and shows every repeated-wrong count', async () => {
    renderPage();

    const summary = await screen.findByRole('region', { name: '常錯題目摘要' });
    expect(summary).toHaveTextContent('錯題數3');
    expect(summary).toHaveTextContent('累計答錯4');
    expect(screen.getByText('累計答錯 2 次')).toBeInTheDocument();

    const filters = screen.getByRole('region', {
      name: '常錯題目科目與年度分類',
    });
    expect(within(filters).getByRole('button', { name: /建築法規與實務/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(within(filters).getByRole('button', { name: '114 年' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('law-114-01 題幹')).toBeInTheDocument();
    expect(screen.queryByText('law-113-03 題幹')).not.toBeInTheDocument();

    fireEvent.click(within(filters).getByRole('button', { name: '113 年' }));
    expect(screen.getByText('law-113-03 題幹')).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();

    fireEvent.click(
      within(filters).getByRole('button', { name: /建築環境控制/ }),
    );
    expect(screen.getByText('env-113-02 題幹')).toBeInTheDocument();
    expect(screen.getByText('累計答錯 1 次')).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });

  it('allows a wrong question to be marked difficult and reviewed again', async () => {
    renderPage([attempts[0]]);

    fireEvent.click(await screen.findByRole('button', { name: '標記為難題' }));
    expect(screen.getByRole('button', { name: '取消難題標記' }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByText('查看選項、重新作答與詳解'));
    expect(await screen.findByRole('region', { name: '第 1 題重新作答' }))
      .toBeInTheDocument();
    expect(screen.getByRole('region', { name: '第 1 題詳解' }))
      .toHaveTextContent('law-114-01 詳解');
  });

  it('displays shared explanations alongside the built-in explanation', async () => {
    renderPage([attempts[0]], [{
      id: 'wrong-shared-explanation', questionId: lawQuestion.id, type: 'explanation', content: '錯題共享詳解', images: [],
      createdAt: '2026-10-27T00:00:00Z', likes: 0, replies: [], reported: false,
    }]);
    fireEvent.click(await screen.findByText('查看選項、重新作答與詳解'));
    const explanation = await screen.findByRole('region', { name: '第 1 題詳解' });
    expect(explanation).toHaveTextContent('law-114-01 詳解');
    expect(explanation).toHaveTextContent('錯題共享詳解');
  });

  it('shows a useful empty state before the first completed paper', async () => {
    renderPage([]);
    expect(await screen.findByRole('heading', { name: '還沒有作答紀錄' }))
      .toBeInTheDocument();
  });
});
