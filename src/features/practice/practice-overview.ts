import type { Question } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { buildMockExamPapers } from './mock-exam';
import { DEFAULT_PRACTICE_SETTINGS, resolvePracticePool } from './practice-session';

/** Build-time figures the practice hub shows beside each practice, so it never ships a bank. */
export interface PracticeOverview {
  /** Subjects, and the questions they draw from with the default settings. */
  quiz: { subjects: number; questions: number };
  cloze: { laws: number; questions: number };
  /** Subjects with a paper, and the papers. */
  mockExam: { subjects: number; papers: number };
}

export function buildPracticeOverview(
  questions: readonly Question[],
  cloze: { laws: readonly unknown[]; questions: readonly unknown[] },
): PracticeOverview {
  const papers = buildMockExamPapers(questions);
  return {
    quiz: {
      subjects: subjects.length,
      questions: subjects.reduce(
        (total, { id }) =>
          total +
          resolvePracticePool(questions, id, DEFAULT_PRACTICE_SETTINGS).eligibleCount,
        0,
      ),
    },
    cloze: { laws: cloze.laws.length, questions: cloze.questions.length },
    mockExam: {
      subjects: new Set(papers.map((paper) => paper.subject)).size,
      papers: papers.length,
    },
  };
}
