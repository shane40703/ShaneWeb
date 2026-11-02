import type { Question, QuizAttempt } from '@/lib/types';
import {
  createPracticeAttempts, createPracticeResult, type PracticeResult, type PracticeSession,
} from './practice-session';

// Use the existing attempts schema and cloud permissions, without treating legacy
// automatic saves (whose source was never stored) as a new opt-in daily record.
export const DAILY_PRACTICE_RECORD_PREFIX = 'daily-practice-';
export const DAILY_PRACTICE_HISTORY_PATH = '/practice-history';
export const DAILY_ACTIVITY_RECORD_PREFIX = 'daily-activity-';

export function isDailyPracticeRecord(attempt: QuizAttempt) {
  return attempt.mode === 'practice' && attempt.id.startsWith(DAILY_PRACTICE_RECORD_PREFIX);
}

/** A count-only record uses the existing sync schema but never stores questions or answers. */
export function dailyActivityRecord(attempt: QuizAttempt): QuizAttempt | null {
  const answered = attempt.correctCount + attempt.wrongCount;
  if (!isDailyPracticeRecord(attempt) || answered === 0) return null;
  return {
    id: DAILY_ACTIVITY_RECORD_PREFIX + attempt.id,
    mode: 'practice',
    subject: attempt.subject,
    year: null,
    questionIds: [],
    answers: {},
    startedAt: attempt.submittedAt,
    submittedAt: attempt.submittedAt,
    elapsedSeconds: 0,
    correctCount: answered,
    wrongCount: 0,
    unansweredCount: 0,
  };
}

export function isDailyActivityRecord(attempt: QuizAttempt) {
  return attempt.mode === 'practice' && attempt.id.startsWith(DAILY_ACTIVITY_RECORD_PREFIX);
}

/** Create stable record IDs once per completion, not on each press of Save. */
export function createRecordablePracticeResult(
  session: PracticeSession,
  questionById: ReadonlyMap<string, Pick<Question, 'options'>>,
  submittedAt = new Date().toISOString(),
): PracticeResult {
  const result = createPracticeResult(session);
  if (session.reviewSource) return result;
  return {
    ...result,
    recording: {
      status: 'pending',
      records: createPracticeAttempts(session, questionById, submittedAt, true).map(record => ({
        ...record,
        attempt: { ...record.attempt, id: DAILY_PRACTICE_RECORD_PREFIX + record.attempt.id },
      })),
    },
  };
}
