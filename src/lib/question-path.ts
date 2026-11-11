import { subjects } from '@/question-bank/catalog';
import type { PaperIndex, QuestionRef } from '@/question-bank/derived-data';
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

/** 歷屆試題（討論版）'s address parts: `['law', '114', '3']`, or `['env', '100', 'written-1']`. */
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

/** 歷屆試題（討論版）'s tabs on a question: 題目, 討論區 and 筆記. */
export type ExamsTab = 'question' | 'discussion' | 'notes';

/** `?tab=discussion|notes`; absent or anything else is the 題目 tab. */
export function examsTab(value: string | string[] | undefined): ExamsTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === 'discussion' || tab === 'notes' ? tab : 'question';
}

/**
 * The router query of an address; /exams itself has no slug, or Next would add a slash. The
 * path says where; only a tab other than 題目 adds `?tab=`.
 */
export function examsQuery(
  slug: readonly string[],
  tab: ExamsTab = 'question',
): { slug?: string[]; tab?: ExamsTab } {
  const query = slug.length ? { slug: [...slug] } : {};
  return tab === 'question' ? query : { ...query, tab };
}

/** The question an address shows. Only an address that names a question shows one. */
export function examsQuestionId(slug: string | string[] | undefined) {
  const [subject, year, question] = examsSlugParts(slug);
  if (!question) return undefined;
  const written = question.startsWith(WRITTEN_PREFIX) ? WRITTEN_PREFIX : '';
  const number = question.slice(written.length).padStart(2, '0');
  return `${subject}-${year}-${written}${number}`;
}

/**
 * What an address under /exams is: 歷屆試題（討論版） itself, a subject, a paper or a question. The
 * first three list the level below them; only a question shows a question.
 */
export type ExamsPlace =
  | { kind: 'bank' }
  | { kind: 'subject'; subject: SubjectId }
  | { kind: 'paper'; subject: SubjectId; year: number }
  | { kind: 'question'; subject: SubjectId; year: number; questionId: string };

/** Every real address parses; anything else falls back to the nearest level that does. */
export function examsPlace(slug: string | string[] | undefined): ExamsPlace {
  const [subjectPart, yearPart, questionPart] = examsSlugParts(slug);
  const subject = subjects.find((item) => item.id === subjectPart)?.id;
  if (!subject) return { kind: 'bank' };
  const year = Number(yearPart);
  if (!yearPart || !Number.isInteger(year)) return { kind: 'subject', subject };
  if (!questionPart) return { kind: 'paper', subject, year };
  return { kind: 'question', subject, year, questionId: examsQuestionId(slug)! };
}

export function examsPlaceSlug(place: ExamsPlace): string[] {
  if (place.kind === 'bank') return [];
  if (place.kind === 'subject') return [place.subject];
  if (place.kind === 'paper') return [place.subject, String(place.year)];
  return examsSlug(place.questionId);
}

/**
 * The address on screen as a reader can come back to it: the path, and the tab only on a
 * question, which is the only address that has tabs.
 */
export function examsAddress(slug: readonly string[], tab: ExamsTab) {
  const href = examsHref(slug);
  return examsPlace([...slug]).kind === 'question' && tab !== 'question'
    ? `${href}?tab=${tab}`
    : href;
}

/**
 * Where a paper starts: its first question in paper order, so 申論第 1 題 when it has written
 * questions. Undefined when the bank has no such paper.
 */
export function examsPaperStart(index: PaperIndex, subject: SubjectId, year: number) {
  const row = index[subject]?.find(([paperYear]) => paperYear === year);
  return row ? [subject, String(year), row[2] > 0 ? 'written-1' : '1'] : undefined;
}

/** Where a subject starts: its newest paper's first question. */
export function examsSubjectStart(index: PaperIndex, subject: SubjectId) {
  const newest = index[subject]?.[0];
  return newest ? examsPaperStart(index, subject, newest[0]) : undefined;
}

/**
 * The name of a level, for its tab title and the topbar. A question is named by its paper;
 * its own number follows in the title.
 */
export function examsHubName(place: ExamsPlace) {
  const subject =
    place.kind === 'bank'
      ? undefined
      : subjects.find((item) => item.id === place.subject);
  if (place.kind === 'bank' || !subject) return '歷屆試題（討論版）';
  if (place.kind === 'subject') return `${subject.name}考古題`;
  return `${place.year} 年${subject.name}考古題`;
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
