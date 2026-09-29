import { subjects } from '@/question-bank/catalog';
import type { QuestionFormat } from '@/lib/types';
import type { SubjectId } from '@/question-bank/schema';

const questionIdPattern = new RegExp(
  `^(${subjects.map((subject) => subject.id).join('|')})-(\\d{3})-(?:(written)-)?(\\d{2})$`,
);

export function questionPath(
  subject: SubjectId,
  year: number,
  questionNumber: number,
  format: QuestionFormat = 'multiple-choice',
) {
  const number = String(questionNumber).padStart(2, '0');
  return `/questions/${subject}/${year}/${format === 'written' ? `written-${number}` : number}`;
}

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

export function questionPathFromId(questionId: string) {
  const parsed = parseQuestionId(questionId);
  return parsed
    ? questionPath(parsed.subject, parsed.year, parsed.questionNumber, parsed.format)
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
