import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttemptReview } from '@/components/attempt-review';
import type { QuizAttempt } from '@/lib/types';

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

describe('AttemptReview', () => {
  it('renders every answer and its complete options', () => {
    render(
      <AttemptReview
        attempt={attempt}
        questions={questions}
      />,
    );

    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    expect(screen.getByText('第一題')).toBeInTheDocument();
    expect(screen.getByText('第二題')).toBeInTheDocument();
    expect(screen.getByText(/你的答案：B/)).toHaveTextContent('標準答案：B');
    expect(screen.getByText(/你的答案：A/)).toHaveTextContent('標準答案：C');
    expect(screen.getAllByText('選項 D')).toHaveLength(2);
    expect(screen.getAllByText('最佳解')).toHaveLength(2);
    expect(screen.getByText('官方題目詳解')).toBeInTheDocument();
    expect(screen.getByText('C．選項 C')).toBeInTheDocument();
    expect(screen.queryByText('查看題目')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看第 1 題' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: '詳解與討論' })[0],
    ).toHaveAttribute('href', '/community?question=law-114-01');
  });
});
