import { describe, expect, it } from 'vitest';
import type { Question, QuizAttempt } from '@/lib/types';
import { getWrongQuestionStats } from '@/lib/wrong-questions';

const questions: Question[] = [
  {
    id: 'law-114-01',
    subject: 'law',
    year: 114,
    questionNumber: 1,
    topic: '建築法',
    primaryCategory: '建築法',
    tags: [],
    text: '第一題',
    content: [{ kind: 'text', text: '第一題' }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [1] },
    source: { kind: 'sample' },
  },
  {
    id: 'law-113-02',
    subject: 'law',
    year: 113,
    questionNumber: 2,
    topic: '建築法',
    primaryCategory: '建築法',
    tags: [],
    text: '第二題',
    content: [{ kind: 'text', text: '第二題' }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  },
];

function attempt(
  id: string,
  submittedAt: string,
  answers: Record<string, number>,
): QuizAttempt {
  return {
    id,
    mode: 'paper',
    subject: 'law',
    year: 114,
    questionIds: Object.keys(answers),
    answers,
    startedAt: submittedAt,
    submittedAt,
    elapsedSeconds: 60,
    correctCount: 0,
    wrongCount: Object.keys(answers).length,
    unansweredCount: 0,
  };
}

describe('getWrongQuestionStats', () => {
  it('keeps repeated mistakes even after a later correct answer', () => {
    const stats = getWrongQuestionStats(
      [
        attempt('a1', '2026-08-01T00:00:00.000Z', {
          'law-114-01': 0,
          'law-113-02': 1,
        }),
        attempt('a2', '2026-08-02T00:00:00.000Z', {
          'law-114-01': 0,
        }),
        attempt('a3', '2026-08-03T00:00:00.000Z', {
          'law-114-01': 1,
        }),
      ],
      questions,
    );

    expect(stats.map(({ question, wrongCount }) => ({
      id: question.id,
      wrongCount,
    }))).toEqual([
      { id: 'law-114-01', wrongCount: 2 },
      { id: 'law-113-02', wrongCount: 1 },
    ]);
    expect(stats[0].lastWrongAt).toBe('2026-08-02T00:00:00.000Z');
  });

  it('ignores unavailable questions and all-credit answers', () => {
    const allCredit = {
      ...questions[0],
      id: 'law-114-03',
      answerKey: { kind: 'all-credit' as const },
    };
    const stats = getWrongQuestionStats(
      [attempt('a1', '2026-08-01T00:00:00.000Z', {
        'missing-question': 0,
        'law-114-03': 2,
      })],
      [allCredit],
    );

    expect(stats).toEqual([]);
  });
});
