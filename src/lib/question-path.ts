import { comparePaperQuestionOrder } from '@/lib/study';
import { subjects } from '@/question-bank/catalog';
import type { QuestionRef } from '@/question-bank/derived-data';
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

const WRITTEN_PREFIX = 'written-';

/** 考古題討論版's address parts: `['law', '114', '3']`, or `['env', '100', 'written-1']`. */
export function examsSlug(questionId: string) {
  const parsed = parseQuestionId(questionId);
  if (!parsed) return [];
  const prefix = parsed.format === 'written' ? WRITTEN_PREFIX : '';
  return [parsed.subject, String(parsed.year), `${prefix}${parsed.questionNumber}`];
}

export function examsHref(slug: readonly string[]) {
  return ['/exams', ...slug].join('/');
}

export function examsQuestionHref(questionId: string) {
  return examsHref(examsSlug(questionId));
}

export function examsSlugParts(slug: string | string[] | undefined) {
  return Array.isArray(slug) ? slug : slug ? [slug] : [];
}

/** The question an address shows; a subject or a paper opens on its first question. */
export function examsQuestionId(
  slug: string | string[] | undefined,
  questions: readonly QuestionRef[],
) {
  const [subject, year, question] = examsSlugParts(slug);
  if (question) {
    const written = question.startsWith(WRITTEN_PREFIX) ? WRITTEN_PREFIX : '';
    const number = question.slice(written.length).padStart(2, '0');
    return `${subject}-${year}-${written}${number}`;
  }
  if (!subject) return undefined;
  return questions
    .filter((item) => item.subject === subject && (!year || item.year === Number(year)))
    .sort(
      (left, right) => right.year - left.year || comparePaperQuestionOrder(left, right),
    )[0]?.id;
}

/** Every address under /exams: each subject, each of its papers and each question. */
export function examsSlugs(
  questions: readonly Pick<QuestionRef, 'id' | 'subject' | 'year'>[],
) {
  const places = new Set<string>();
  for (const { subject, year } of questions) {
    places.add(subject).add(`${subject}/${year}`);
  }
  return [
    ...[...places].map((place) => place.split('/')),
    ...questions.map(({ id }) => examsSlug(id)),
  ];
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
