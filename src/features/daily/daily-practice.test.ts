import { describe, expect, it } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import {
  applyDailyOptionOrder,
  createDailyPracticeSession,
  DAILY_QUESTIONS_PER_SUBJECT,
  getMillisecondsUntilTaipeiMidnight,
  parseDailyCompletionRecord,
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
  it('draws fifty questions for only the selected subject', () => {
    const questions = (['law', 'env'] as const).flatMap((subject) =>
      Array.from({ length: 60 }, (_, index) => question(subject, index + 1)),
    );

    const session = createDailyPracticeSession(
      questions,
      ['law', 'env'],
      '2026-10-07',
      () => 0.5,
    );

    expect(session.questionIds).toHaveLength(DAILY_QUESTIONS_PER_SUBJECT);
    expect(session.subjects).toEqual(['law']);
    expect(session.questionIds.filter((id) => id.startsWith('law-'))).toHaveLength(50);
    expect(session.questionIds.filter((id) => id.startsWith('env-'))).toHaveLength(0);
    expect(new Set(session.questionIds)).toHaveLength(50);
    expect(Object.keys(session.optionOrders)).toHaveLength(50);
  });

  it('requires review only at a level boundary because the mistake limit ends the run', () => {
    expect(shouldEnterDailyReview(3, 50, 3)).toBe(false);
    expect(shouldEnterDailyReview(5, 50, 1)).toBe(true);
    expect(shouldEnterDailyReview(4, 50, 1)).toBe(false);
    expect(shouldEnterDailyReview(50, 50, 1)).toBe(true);
  });

  it('reorders answer choices together with the accepted answer', () => {
    const reordered = applyDailyOptionOrder(question('law', 1), [2, 0, 3, 1]);

    expect(reordered.options).toEqual(['C', 'A', 'D', 'B']);
    expect(reordered.answerKey).toEqual({ kind: 'accepted', options: [1] });
  });

  it('refreshes at the next Taipei midnight instead of after 24 hours', () => {
    expect(
      getMillisecondsUntilTaipeiMidnight(new Date('2026-10-07T15:59:00.000Z')),
    ).toBe(60_000);
    expect(
      getMillisecondsUntilTaipeiMidnight(new Date('2026-10-07T16:01:00.000Z')),
    ).toBe(86_340_000);
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

  it('keeps completed subjects locked only on the recorded date', () => {
    const record = JSON.stringify({
      date: '2026-10-07',
      subjects: ['law', 'env', 'invalid'],
    });

    expect(parseDailyCompletionRecord(record, '2026-10-07')).toEqual({
      date: '2026-10-07',
      subjects: ['law', 'env'],
    });
    expect(parseDailyCompletionRecord(record, '2026-10-08')).toEqual({
      date: '2026-10-08',
      subjects: [],
    });
  });
});
