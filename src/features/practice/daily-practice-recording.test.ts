import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/types';
import { createRecordablePracticeResult, dailyActivityRecord, isDailyActivityRecord, isDailyPracticeRecord } from './daily-practice-recording';
import { isQuizAttempt, parseStoredState } from '@/lib/study';
import { createPracticeSessionFromQuestions } from './practice-session';

const question: Question = {
  id: 'law-114-01', subject: 'law', year: 114, questionNumber: 1,
  text: '題幹', content: [{ kind: 'text', text: '題幹' }], options: ['甲', '乙'],
  answerKey: { kind: 'accepted', options: [0] }, topic: '測試', primaryCategory: '測試', tags: [], source: { kind: 'sample' },
};
const bank = new Map([[question.id, question]]);
const submittedAt = '2026-10-27T04:00:00.000Z';

describe('explicit daily practice records', () => {
  it('prepares stable records without mutating the session and remaps shuffled answers', () => {
    const session = createPracticeSessionFromQuestions([question], 'law', false);
    session.optionOrders[question.id] = [1, 0];
    session.answers[question.id] = { selected: 1, correct: true };
    session.elapsedSeconds[question.id] = 42;
    const before = JSON.stringify(session);
    const result = createRecordablePracticeResult(session, bank, submittedAt);
    expect(result.recording?.status).toBe('pending');
    expect(result.recording?.records).toHaveLength(1);
    const record = result.recording!.records[0];
    expect(isDailyPracticeRecord(record.attempt)).toBe(true);
    expect(record.attempt).toMatchObject({ mode: 'practice', submittedAt, answers: { [question.id]: 0 }, elapsedSeconds: 42, correctCount: 1 });
    expect(record.results).toEqual({ [question.id]: true });
    expect(JSON.stringify(session)).toBe(before);
    expect(isDailyPracticeRecord({ ...record.attempt, mode: 'paper' })).toBe(false);
    expect(isDailyPracticeRecord({ ...record.attempt, id: 'legacy-practice' })).toBe(false);
  });

  it('can explicitly keep a fully unanswered set, including its questions and elapsed time', () => {
    const session = createPracticeSessionFromQuestions([question], 'law', false);
    session.elapsedSeconds[question.id] = 15;
    const result = createRecordablePracticeResult(session, bank, submittedAt);
    expect(result.summary.accuracy).toBeNull();
    expect(result.recording?.records[0].attempt).toMatchObject({ questionIds: [question.id], answers: {}, elapsedSeconds: 15, correctCount: 0, wrongCount: 0, unansweredCount: 1 });
    expect(dailyActivityRecord(result.recording!.records[0].attempt)).toBeNull();
  });

  it('creates a sync-compatible count-only record without exposing the question or answer', () => {
    const session = createPracticeSessionFromQuestions([question], 'law', false);
    session.answers[question.id] = { selected: 0, correct: true };
    const full = createRecordablePracticeResult(session, bank, submittedAt).recording!.records[0].attempt;
    const activity = dailyActivityRecord(full)!;
    expect(activity).toMatchObject({
      id: `daily-activity-${full.id}`, mode: 'practice', submittedAt,
      questionIds: [], answers: {}, correctCount: 1, wrongCount: 0, unansweredCount: 0,
    });
    expect(JSON.stringify(activity)).not.toContain(question.id);
    expect(isDailyActivityRecord(activity)).toBe(true);
    expect(isDailyPracticeRecord(activity)).toBe(false);
    expect(isQuizAttempt(activity)).toBe(true);
    expect(parseStoredState(JSON.stringify({ attempts: [activity] })).attempts).toEqual([activity]);
    expect(dailyActivityRecord({ ...full, id: 'legacy' })).toBeNull();
  });

  it.each(['difficult', 'wrong'] as const)('never classifies a %s review as a daily draw', source => {
    const session = { ...createPracticeSessionFromQuestions([question], 'law', false), reviewSource: source };
    expect(createRecordablePracticeResult(session, bank, submittedAt).recording).toBeUndefined();
  });
});
