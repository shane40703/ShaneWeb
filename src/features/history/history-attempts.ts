import { isDailyPracticeRecord } from '@/features/practice/daily-practice-recording';
import type { QuizAttempt } from '@/lib/types';

/** Select a history view without deleting or rewriting stored attempts. */
export function selectHistoryAttempts(attempts: readonly QuizAttempt[], dailyOnly: boolean) {
  return attempts.filter(dailyOnly ? isDailyPracticeRecord : attempt => attempt.mode === 'paper');
}
