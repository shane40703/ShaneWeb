import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { WrongPage } from '@/features/wrong/wrong-page';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';

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
  attempt('env-1', 'env', 113, '2026-08-03T00:00:00.000Z', {
    [environmentQuestion.id]: 3,
  }),
];

function renderPage(sourceAttempts = attempts) {
  const state = createDefaultState();
  state.attempts = sourceAttempts;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return render(
    <ToastProvider>
      <AppStateProvider>
        <WrongPage
          attempts={sourceAttempts}
          questions={[lawQuestion, environmentQuestion]}
          questionBankStatuses={{ law: 'ready', env: 'ready' }}
        />
      </AppStateProvider>
    </ToastProvider>,
  );
}

afterEach(cleanup);

describe('WrongPage', () => {
  beforeEach(() => window.localStorage.clear());

  it('groups saved mistakes and shows every repeated-wrong count', async () => {
    renderPage();

    const summary = await screen.findByRole('region', { name: '常錯題目摘要' });
    expect(summary).toHaveTextContent('錯題數2');
    expect(summary).toHaveTextContent('累計答錯3');
    expect(screen.getByText('累計答錯 2 次')).toBeInTheDocument();

    const filters = screen.getByRole('group', { name: '常錯題目科目分類' });
    expect(within(filters).getByRole('button', { name: '建築法規與實務 1' }))
      .toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(filters).getByRole('button', { name: '建築環境控制 1' }),
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
    expect(screen.getByRole('region', { name: '第 1 題重新作答' }))
      .toBeInTheDocument();
    expect(screen.getByRole('region', { name: '第 1 題詳解' }))
      .toHaveTextContent('law-114-01 詳解');
  });

  it('shows a useful empty state before the first completed paper', async () => {
    renderPage([]);
    expect(await screen.findByRole('heading', { name: '還沒有作答紀錄' }))
      .toBeInTheDocument();
  });
});
