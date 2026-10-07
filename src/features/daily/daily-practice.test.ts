import { describe, expect, it } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import {
  createDailyPracticeSession,
  DAILY_QUESTIONS_PER_SUBJECT,
  parseDailyPracticeSession,
  shouldEnterDailyReview,
} from './daily-practice';

function question(subject: SubjectId, number: number): Question {
  return {
    id: `${subject}-114-${String(number).padStart(2, '0')}`,
    subject,
    year: 114,
    questionNumber: number,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `第 ${number} 題`,
    content: [{ kind: 'text', text: `第 ${number} 題` }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

describe('daily practice', () => {
  it('draws fifty questions for every selected subject', () => {
    const questions = (['law', 'env'] as const).flatMap((subject) =>
      Array.from({ length: 60 }, (_, index) => question(subject, index + 1)),
    );

    const session = createDailyPracticeSession(
      questions,
      ['law', 'env'],
      '2026-10-07',
      () => 0.5,
    );

    expect(session.questionIds).toHaveLength(DAILY_QUESTIONS_PER_SUBJECT * 2);
    expect(session.questionIds.filter((id) => id.startsWith('law-'))).toHaveLength(50);
    expect(session.questionIds.filter((id) => id.startsWith('env-'))).toHaveLength(50);
    expect(new Set(session.questionIds)).toHaveLength(100);
  });

  it('requires review at a level boundary or after three mistakes', () => {
    expect(shouldEnterDailyReview(3, 50, 3)).toBe(true);
    expect(shouldEnterDailyReview(5, 50, 1)).toBe(true);
    expect(shouldEnterDailyReview(4, 50, 1)).toBe(false);
    expect(shouldEnterDailyReview(50, 50, 1)).toBe(true);
  });

  it('restores only a valid session from the same Taipei date', () => {
    const session = createDailyPracticeSession(
      [question('law', 1)],
      ['law'],
      '2026-10-07',
    );
    session.answers[session.questionIds[0]] = { selected: 1, correct: false };

    expect(
      parseDailyPracticeSession(JSON.stringify(session), '2026-10-07'),
    ).toEqual(session);
    expect(
      parseDailyPracticeSession(JSON.stringify(session), '2026-10-08'),
    ).toBeNull();
    expect(parseDailyPracticeSession('{broken', '2026-10-07')).toBeNull();
  });
});
