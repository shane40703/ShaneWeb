import { subjects } from '@/question-bank/catalog';
import type { SubjectId } from '@/question-bank/schema';

const questionIdPattern = new RegExp(
  `^(${subjects.map((subject) => subject.id).join('|')})-(\\d{3})-(\\d{2})$`,
);

export function questionPath(subject: SubjectId, year: number, questionNumber: number) {
  return `/questions/${subject}/${year}/${String(questionNumber).padStart(2, '0')}`;
}

export function parseQuestionId(questionId: string) {
  const match = questionIdPattern.exec(questionId);
  return match
    ? {
        subject: match[1] as SubjectId,
        year: Number(match[2]),
        questionNumber: Number(match[3]),
      }
    : null;
}

export function questionPathFromId(questionId: string) {
  const parsed = parseQuestionId(questionId);
  return parsed ? questionPath(parsed.subject, parsed.year, parsed.questionNumber) : null;
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
