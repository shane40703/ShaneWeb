import type { Question, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { buildMockExamPapers, type MockExamPaperRef } from './mock-exam';
import { DEFAULT_PRACTICE_SETTINGS, resolvePracticePool } from './practice-session';

/** Build-time figures for the practice hub, small enough that the hub never ships a bank. */
export interface PracticeOverview {
  /** Questions each subject draws from with the default settings, in catalog order. */
  subjects: { subject: SubjectId; count: number }[];
  cloze: { laws: number; questions: number };
  /** The mock exam's papers, with only what the hub's draft list needs. */
  papers: MockExamPaperRef[];
}

export function buildPracticeOverview(
  questions: readonly Question[],
  cloze: { laws: readonly unknown[]; questions: readonly unknown[] },
): PracticeOverview {
  return {
    subjects: subjects.map(({ id }) => ({
      subject: id,
      count: resolvePracticePool(questions, id, DEFAULT_PRACTICE_SETTINGS).eligibleCount,
    })),
    cloze: { laws: cloze.laws.length, questions: cloze.questions.length },
    papers: buildMockExamPapers(questions).map(({ subject, year, questionCount }) => ({
      subject,
      year,
      questionCount,
    })),
  };
}
