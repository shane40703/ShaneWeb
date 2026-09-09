import { isQuestionCorrect } from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';

export interface WrongQuestionStat {
  question: Question;
  wrongCount: number;
  lastWrongAt: string;
}
/**
 * Counts every incorrect selection in saved paper attempts. A later correct
 * answer does not erase earlier mistakes, so the result describes the user's
 * repeated-error history instead of only their latest answer.
 */
export function getWrongQuestionStats(
  attempts: readonly QuizAttempt[],
  questions: readonly Question[],
): WrongQuestionStat[] {
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const stats = new Map<
    string,
    { question: Question; wrongCount: number; lastWrongAt: string }
  >();

  attempts.forEach((attempt) => {
    Object.entries(attempt.answers).forEach(([questionId, selected]) => {
      const question = questionById.get(questionId);
      if (!question || isQuestionCorrect(question, selected)) return;
      const current = stats.get(questionId);
      stats.set(questionId, {
        question,
        wrongCount: (current?.wrongCount ?? 0) + 1,
        lastWrongAt:
          !current || attempt.submittedAt > current.lastWrongAt
            ? attempt.submittedAt
            : current.lastWrongAt,
      });
    });
  });

  return [...stats.values()].sort(
    (left, right) =>
      right.wrongCount - left.wrongCount ||
      right.lastWrongAt.localeCompare(left.lastWrongAt) ||
      right.question.year - left.question.year ||
      left.question.questionNumber - right.question.questionNumber,
  );
}
