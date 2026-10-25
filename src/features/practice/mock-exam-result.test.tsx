import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuizAttempt } from '@/lib/types';
import { MockExamResult } from './mock-exam-result';

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({ state: { difficultQuestionIds: [], attempts: [] } }),
}));

afterEach(cleanup);

describe('MockExamResult score summary', () => {
  it.each([
    { subject: 'law', correct: 76, score: 95, maximum: 100, percentage: 95 },
    { subject: 'law', correct: 0, score: 0, maximum: 100, percentage: 0 },
    { subject: 'law', correct: 80, score: 100, maximum: 100, percentage: 100 },
    { subject: 'env', correct: 30, score: 45, maximum: 60, percentage: 75 },
    { subject: 'env', correct: 40, score: 60, maximum: 60, percentage: 100 },
  ] as const)('shows $subject $score/$maximum with the correct ring proportion, even before questions load', ({ subject, correct, score, maximum, percentage }) => {
    const total = subject === 'law' ? 80 : 40;
    const ids = Array.from({ length: total }, (_, index) => `${subject}-114-${String(index + 1).padStart(2, '0')}`);
    const wrong = Math.min(4, total - correct);
    const blank = total - correct - wrong;
    const attempt: QuizAttempt = {
      id: 'saved-score', mode: 'paper', subject, year: 114,
      questionIds: ids,
      answers: Object.fromEntries(ids.slice(0, correct + wrong).map(id => [id, 0])),
      startedAt: '2026-10-24T00:00:00.000Z', submittedAt: '2026-10-24T01:04:00.000Z',
      elapsedSeconds: 3840, correctCount: correct, wrongCount: wrong, unansweredCount: blank,
    };
    render(
      <MockExamResult
        paper={{ subject, year: 114, questionCount: total, writtenCount: 0, firstWrittenId: null }}
        attempt={attempt}
        questions={[]}
        status="loading"
        onRetry={vi.fn()}
      />,
    );

    const meter = screen.getByRole('meter', { name: '模擬考分數' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuenow', String(score));
    expect(meter).toHaveAttribute('aria-valuemax', String(maximum));
    expect(meter).toHaveAttribute('aria-valuetext', `${score.toFixed(2)} 分，滿分 ${maximum} 分`);
    expect(meter.style.getPropertyValue('--score-percentage')).toBe(`${percentage}%`);
    expect(within(meter).getByText(score.toFixed(2))).toBeInTheDocument();
    const summary = meter.closest('section')!;
    expect([...summary.querySelectorAll('dt')].map(element => element.textContent))
      .toEqual(['答錯題數', '未作答', '作答時間']);
    expect([...summary.querySelectorAll('dd')].map(element => element.textContent))
      .toEqual([String(wrong), String(blank), '01:04:00']);
    expect(within(summary).queryByRole('button')).not.toBeInTheDocument();
    expect(within(summary).queryByText('答對')).not.toBeInTheDocument();
    expect(within(summary).queryByText('MOCK EXAM RESULT')).not.toBeInTheDocument();
  });
});
