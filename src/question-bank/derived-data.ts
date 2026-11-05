import { getLawQuestionFineTopic } from '@/lib/law-question-topics';
import { comparePaperQuestionOrder, getQuestionDisplayCategories } from '@/lib/study';
import type { Question, QuestionSummary, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';

/**
 * The files generated from the bank, each made for one kind of screen. Pure on purpose: the
 * generator, the prerendered pages, the browser and Storybook all build or read the same shapes.
 *
 *   <subject>/<year>.json            a paper: everything to read and answer it
 *   <subject>/facets.json            what screens count, filter and grade by, no text
 *   <subject>/stems.json             考題分析 rows
 *   law/similar/<key>.json           類似考題 rows of one fine topic
 *
 * The list of papers is not a file: it ships with the pages that navigate over it.
 */

/** [year, multiple-choice questions, written questions], newest year first. */
export type PaperRow = readonly [year: number, multipleChoice: number, written: number];
export type PaperIndex = Partial<Record<SubjectId, readonly PaperRow[]>>;

/** What navigation needs of a question: its place, never its content. */
export type QuestionRef = Pick<
  Question,
  'id' | 'format' | 'subject' | 'year' | 'questionNumber'
>;

/** A question that is known to exist, with its body once its paper has loaded. */
export type QuestionEntry = QuestionRef | Question;

export function hasBody(entry: QuestionEntry): entry is Question {
  return 'content' in entry;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

function refId(subject: SubjectId, year: number, written: boolean, number: number) {
  return `${subject}-${year}-${written ? 'written-' : ''}${twoDigits(number)}`;
}

export function buildPaperIndex(questions: readonly QuestionRef[]): PaperIndex {
  const index: PaperIndex = {};
  for (const subject of subjects) {
    const papers = new Map<number, [number, number, number]>();
    for (const question of questions) {
      if (question.subject !== subject.id) continue;
      const row = papers.get(question.year) ?? [question.year, 0, 0];
      row[question.format === 'written' ? 2 : 1] += 1;
      papers.set(question.year, row);
    }
    if (papers.size) {
      index[subject.id] = [...papers.values()].sort((left, right) => right[0] - left[0]);
    }
  }
  return index;
}

/** Every question in bank order: subject, newest year, written first, then number. */
export function questionRefs(index: PaperIndex): QuestionRef[] {
  const refs: QuestionRef[] = [];
  for (const { id: subject } of subjects) {
    for (const [year, multipleChoice, written] of index[subject] ?? []) {
      for (let number = 1; number <= written; number += 1) {
        refs.push({
          id: refId(subject, year, true, number),
          format: 'written',
          subject,
          year,
          questionNumber: number,
        });
      }
      for (let number = 1; number <= multipleChoice; number += 1) {
        refs.push({
          id: refId(subject, year, false, number),
          format: 'multiple-choice',
          subject,
          year,
          questionNumber: number,
        });
      }
    }
  }
  return refs;
}

/** What a set of papers holds, for the overview pages' sentences and figures. */
export interface PaperFacts {
  /** Subjects with at least one paper, in catalog order. */
  subjects: SubjectId[];
  papers: number;
  multipleChoice: number;
  written: number;
  firstYear?: number;
  lastYear?: number;
}

/** The whole bank, one subject or one paper of it. */
export function paperFacts(
  index: PaperIndex,
  subject?: SubjectId,
  year?: number,
): PaperFacts {
  const facts: PaperFacts = { subjects: [], papers: 0, multipleChoice: 0, written: 0 };
  for (const { id } of subjects) {
    if (subject && id !== subject) continue;
    const rows = (index[id] ?? []).filter(([paperYear]) => !year || paperYear === year);
    if (!rows.length) continue;
    facts.subjects.push(id);
    for (const [paperYear, multipleChoice, written] of rows) {
      facts.papers += 1;
      facts.multipleChoice += multipleChoice;
      facts.written += written;
      facts.firstYear = Math.min(facts.firstYear ?? paperYear, paperYear);
      facts.lastYear = Math.max(facts.lastYear ?? paperYear, paperYear);
    }
  }
  return facts;
}

/** [question id, the topic words its page shows as tags], in paper order. */
export type PaperTopicRow = readonly [id: string, labels: readonly string[]];

/** One paper's topic words: all a paper's overview page needs of its questions. */
export interface PaperTopics {
  subject: SubjectId;
  year: number;
  rows: readonly PaperTopicRow[];
}

type TopicFields = Pick<
  Question,
  | 'id'
  | 'format'
  | 'questionNumber'
  | 'subject'
  | 'topic'
  | 'primaryCategory'
  | 'relatedLaws'
>;

/**
 * The same words the question page shows as tags, written questions first. The build reads
 * them from the summaries and the browser from the paper file, so both must give the same rows.
 */
export function paperTopicsOf(questions: readonly TopicFields[]): PaperTopicRow[] {
  return [...questions]
    .sort(comparePaperQuestionOrder)
    .map((question) => [question.id, getQuestionDisplayCategories(question)] as const);
}

/**
 * The paper's most tested topics with their question counts: most questions first, a tie in
 * paper order. A question with two laws counts for both.
 */
export function topLabels(rows: readonly PaperTopicRow[], count: number) {
  const counts = new Map<string, number>();
  for (const [, labels] of rows) {
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // A Map keeps first-appearance order and the sort is stable, so ties stay in paper order.
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, count);
}

/**
 * A paper's topics: the prerendered ones when they are this paper's, otherwise from its loaded
 * questions, or null while the paper is still on its way.
 */
export function paperTopicsFor(
  subject: SubjectId,
  year: number,
  seed: PaperTopics | null | undefined,
  entries: readonly QuestionEntry[],
): PaperTopics | null {
  if (seed?.subject === subject && seed.year === year) return seed;
  const paper = entries.filter(
    (entry) => entry.subject === subject && entry.year === year,
  );
  const bodies = paper.filter(hasBody);
  if (!paper.length || bodies.length !== paper.length) return null;
  return { subject, year, rows: paperTopicsOf(bodies) };
}

/** Fails the build rather than publish ids that do not exist. */
export function assertRefsMatch(index: PaperIndex, questions: readonly QuestionRef[]) {
  const rebuilt = new Set(questionRefs(index).map((ref) => ref.id));
  const missing = questions.find((question) => !rebuilt.has(question.id));
  if (missing || rebuilt.size !== questions.length) {
    throw new Error(
      `Paper numbering has a gap near ${missing?.id ?? 'the end of the bank'}`,
    );
  }
}

export interface FacetPaper {
  /** Year. */
  y: number;
  /** Index into `classes`, one per question; a question is its position + 1. */
  k: readonly number[];
  /** 0 is 一律給分; otherwise a mask of the accepted options, bit 0 being A. */
  a: readonly number[];
  /** 1 + index into `lawSets`, 0 for none. */
  l?: readonly number[];
  /** 1 + index into `fineTopics`, 0 for none. */
  f?: readonly number[];
}

export interface SubjectFacets {
  /** [topic, primaryCategory] */
  classes: readonly (readonly [string, string])[];
  lawSets?: readonly (readonly string[])[];
  fineTopics?: readonly string[];
  papers: readonly FacetPaper[];
}

const FACET_OPTION_COUNT = 4;

function answerCode(question: Question) {
  const { answerKey } = question;
  if (answerKey.kind === 'all-credit') return 0;
  if (answerKey.kind === 'written') throw new Error(`${question.id}: written in facets`);
  const mask = answerKey.options.reduce((sum, option) => sum | (1 << option), 0);
  if (!mask) throw new Error(`${question.id}: accepted answer without options`);
  return mask;
}

function interner<T>(values: T[]) {
  const positions = new Map<string, number>();
  return (key: string, value: T) => {
    let position = positions.get(key);
    if (position === undefined) {
      position = values.length;
      positions.set(key, position);
      values.push(value);
    }
    return position;
  };
}

/** One subject's multiple-choice questions, newest paper first. */
export function buildFacets(questions: readonly Question[]): SubjectFacets {
  const classes: (readonly [string, string])[] = [];
  const lawSets: (readonly string[])[] = [];
  const fineTopics: string[] = [];
  const internClass = interner(classes);
  const internLaws = interner(lawSets);
  const internFine = interner(fineTopics);
  const rows = new Map<
    number,
    { kind: number; answer: number; laws: number; fine: number }[]
  >();
  for (const question of questions) {
    if (question.format === 'written') continue;
    if (question.options.length !== FACET_OPTION_COUNT) {
      throw new Error(`${question.id}: facets assume ${FACET_OPTION_COUNT} options`);
    }
    const paper = rows.get(question.year) ?? [];
    paper[question.questionNumber - 1] = {
      kind: internClass(`${question.topic}\u0000${question.primaryCategory}`, [
        question.topic,
        question.primaryCategory,
      ]),
      answer: answerCode(question),
      laws: question.relatedLaws?.length
        ? internLaws(question.relatedLaws.join('\u0000'), question.relatedLaws) + 1
        : 0,
      fine: question.fineTopic
        ? internFine(question.fineTopic, question.fineTopic) + 1
        : 0,
    };
    rows.set(question.year, paper);
  }
  const papers = [...rows.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, paper]) => {
      if (
        paper.includes(undefined as never) ||
        Object.keys(paper).length !== paper.length
      ) {
        throw new Error(`Facets of ${year} have a numbering gap`);
      }
      return {
        y: year,
        k: paper.map((row) => row.kind),
        a: paper.map((row) => row.answer),
        ...(lawSets.length ? { l: paper.map((row) => row.laws) } : {}),
        ...(fineTopics.length ? { f: paper.map((row) => row.fine) } : {}),
      };
    });
  return {
    classes,
    ...(lawSets.length ? { lawSets } : {}),
    ...(fineTopics.length ? { fineTopics } : {}),
    papers,
  };
}

function facetFields(subject: SubjectId, facets: SubjectFacets) {
  return facets.papers.flatMap((paper) =>
    paper.k.map((kind, index) => {
      const [topic, primaryCategory] = facets.classes[kind];
      const laws = paper.l?.[index] ? facets.lawSets?.[paper.l[index] - 1] : undefined;
      const fineTopic = paper.f?.[index]
        ? facets.fineTopics?.[paper.f[index] - 1]
        : undefined;
      return {
        answer: paper.a[index],
        fields: {
          id: refId(subject, paper.y, false, index + 1),
          format: 'multiple-choice' as const,
          subject,
          year: paper.y,
          questionNumber: index + 1,
          primaryCategory,
          topic,
          tags: [topic],
          ...(laws?.length ? { relatedLaws: laws } : {}),
          ...(fineTopic ? { fineTopic } : {}),
        },
      };
    }),
  );
}

const noOptions = Array.from({ length: FACET_OPTION_COUNT }, () => '');

/**
 * Questions without a body, for the code that counts, filters, draws and grades: the option
 * count and answer key are real, the text is empty. These never reach a screen that reads a
 * question; those get a body from `useQuestionBodies`.
 */
export function facetQuestions(subject: SubjectId, facets: SubjectFacets): Question[] {
  return facetFields(subject, facets).map(({ answer, fields }) => ({
    ...fields,
    text: '',
    content: [],
    options: noOptions,
    answerKey: answer
      ? {
          kind: 'accepted' as const,
          options: [0, 1, 2, 3].filter((option) => answer & (1 << option)),
        }
      : { kind: 'all-credit' as const },
    source: { kind: 'sample' as const },
  }));
}

export type SubjectStems = Readonly<Record<string, readonly string[]>>;

/** Stems of multiple-choice questions, by year and position. */
export function buildStems(
  questions: readonly Question[],
  onlyYear?: number,
): SubjectStems {
  const stems: Record<string, string[]> = {};
  for (const question of questions) {
    if (question.format === 'written') continue;
    if (onlyYear !== undefined && question.year !== onlyYear) continue;
    (stems[question.year] ??= [])[question.questionNumber - 1] = question.text;
  }
  return stems;
}

/** The summaries 考題分析 reads. Text is empty until that year's stems are here. */
export function facetSummaries(
  subject: SubjectId,
  facets: SubjectFacets,
  stems: SubjectStems = {},
): QuestionSummary[] {
  return facetFields(subject, facets).map(({ fields }) => ({
    ...fields,
    text: stems[fields.year]?.[fields.questionNumber - 1] ?? '',
  }));
}

/** [question id, stem], newest year first, then by number. */
export type SimilarRow = readonly [id: string, text: string];

/** FNV-1a: short, stable and the same on both sides, so a topic names its own file. */
export function similarFileKey(topic: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < topic.length; index += 1) {
    hash ^= topic.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function similarRowsOf(
  questions: readonly Question[],
  topic: string,
): SimilarRow[] {
  return questions
    .filter((question) => getLawQuestionFineTopic(question) === topic)
    .sort(
      (left, right) =>
        right.year - left.year || left.questionNumber - right.questionNumber,
    )
    .map((question) => [question.id, question.text] as const);
}

/** Every law topic's rows by file key. A collision fails the build. */
export function buildSimilarFiles(lawQuestions: readonly Question[]) {
  const topics = new Set(
    lawQuestions.flatMap((question) => getLawQuestionFineTopic(question) ?? []),
  );
  const files = new Map<string, SimilarRow[]>();
  for (const topic of topics) {
    const key = similarFileKey(topic);
    if (files.has(key)) throw new Error(`Similar file collision on ${topic}`);
    files.set(key, similarRowsOf(lawQuestions, topic));
  }
  return files;
}
