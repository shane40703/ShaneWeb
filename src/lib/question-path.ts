import { subjects } from '@/question-bank/catalog';
import type { SubjectId } from '@/question-bank/schema';

const questionIdPattern = new RegExp(
  `^(${subjects.map((subject) => subject.id).join('|')})-(\\d{3})-(?:(written)-)?(\\d{2})$`,
);

export function parseQuestionId(questionId: string) {
  const match = questionIdPattern.exec(questionId);
  return match
    ? {
        subject: match[1] as SubjectId,
        year: Number(match[2]),
        format: match[3] ? ('written' as const) : ('multiple-choice' as const),
        questionNumber: Number(match[4]),
      }
    : null;
}

/** Subjects referenced by a set of question ids, in catalog order. */
export function subjectsOfQuestionIds(questionIds: readonly string[]): SubjectId[] {
  const referenced = new Set(
    questionIds.flatMap((id) => {
      const parsed = parseQuestionId(id);
      return parsed ? [parsed.subject] : [];
    }),
  );
  return subjects
    .map((subject) => subject.id)
    .filter((subject) => referenced.has(subject));
}
