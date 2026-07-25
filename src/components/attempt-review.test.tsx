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
        hrefForQuestion={(question) => question.path}
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
    expect(screen.getByRole('link', { name: '查看第 1 題' })).toHaveAttribute(
      'href',
      questions[0].path,
    );
  });
});
