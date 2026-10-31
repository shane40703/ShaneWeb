// @vitest-environment node
/**
 * Runs the app's own logic on today's full bank and on the derived files, over every question,
 * and requires the same answers. If a derived file ever loses something a screen relies on,
 * this fails at the question that shows it.
 *
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildForecastRanking,
  buildTrendSeries,
} from '@/features/analysis/detailed-trend-analysis';
import { buildMockExamPapers } from '@/features/practice/mock-exam';
import {
  createPracticeSessionFromQuestions,
  DEFAULT_PRACTICE_SETTINGS,
  resolvePracticePool,
  subjectReviewQuestions,
  type PracticeSettings,
} from '@/features/practice/practice-session';
import { buildLawDatabaseEntries } from '@/features/laws/law-database';
import { getLawQuestionFineTopic } from '@/lib/law-question-topics';
import {
  comparePaperQuestionOrder,
  getAnalysis,
  getAnalysisCategory,
  getLawAnalysis,
  getQuestionDisplayCategories,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question, QuestionSummary, SubjectId } from '@/lib/types';
import { subjects, years } from '@/question-bank/catalog';
import {
  buildFacets,
  buildPaperIndex,
  buildSimilarFiles,
  buildStems,
  facetQuestions,
  facetSummaries,
  questionRefs,
  similarFileKey,
} from '@/question-bank/derived-data';
import { loadSubjectQuestions } from '@/server/question-bank.server';

let bank: Question[] = [];
const bySubject = {} as Record<SubjectId, Question[]>;
const facets = {} as Record<SubjectId, ReturnType<typeof buildFacets>>;

beforeAll(async () => {
  for (const subject of subjects) {
    const papers = await Promise.all(
      years.map((year) => loadSubjectQuestions(subject.id, year)),
    );
    bySubject[subject.id] = papers.flat();
    // Through JSON, as a file would arrive.
    facets[subject.id] = JSON.parse(JSON.stringify(buildFacets(bySubject[subject.id])));
  }
  bank = subjects.flatMap((subject) => bySubject[subject.id]);
}, 60_000);

const multipleChoice = (questions: readonly Question[]) =>
  questions.filter((question) => question.format !== 'written');

const settingsToTry: PracticeSettings[] = [
  DEFAULT_PRACTICE_SETTINGS,
  { ...DEFAULT_PRACTICE_SETTINGS, includeAllCredit: true },
  { ...DEFAULT_PRACTICE_SETTINGS, fromYear: 105, toYear: 110 },
  { ...DEFAULT_PRACTICE_SETTINGS, fromYear: 112, toYear: 100, count: 5 },
  { ...DEFAULT_PRACTICE_SETTINGS, count: 20, fromYear: 100, toYear: 100 },
];

function poolView(pool: ReturnType<typeof resolvePracticePool>) {
  const { candidates, rangeCandidates, ...rest } = pool;
  return {
    ...rest,
    candidates: candidates.map((question) => question.id).sort(),
    rangeCandidates: rangeCandidates.map((question) => question.id).sort(),
  };
}

describe('the real bank survives the split', () => {
  it('has the whole bank to compare against', () => {
    expect(new Set(bank.map((question) => question.subject)).size).toBe(subjects.length);
    expect(bank.length).toBeGreaterThan(3000);
  });

  it('rebuilds every id, in the order the screens use, from the paper index', () => {
    const index = JSON.parse(JSON.stringify(buildPaperIndex(bank)));
    const refs = questionRefs(index);
    expect(refs.map((ref) => ref.id).sort()).toEqual(bank.map((q) => q.id).sort());
    for (const ref of refs) {
      const question = bank.find((item) => item.id === ref.id)!;
      expect(ref).toEqual({
        id: question.id,
        format: question.format,
        subject: question.subject,
        year: question.year,
        questionNumber: question.questionNumber,
      });
    }
    // The same sort the pages run, so 上一題／下一題 cross papers identically.
    const order = (
      list: readonly Pick<
        Question,
        'id' | 'subject' | 'year' | 'format' | 'questionNumber'
      >[],
    ) =>
      subjects.flatMap(({ id }) =>
        list
          .filter((item) => item.subject === id)
          .sort(
            (left, right) =>
              right.year - left.year || comparePaperQuestionOrder(left, right),
          )
          .map((item) => item.id),
      );
    expect(order(refs)).toEqual(order(bank));
    expect(buildMockExamPapers(refs)).toEqual(buildMockExamPapers(bank));
  });

  it('builds identical practice pools, for every subject and several settings', () => {
    for (const subject of subjects) {
      const facetBank = facetQuestions(subject.id, facets[subject.id]);
      for (const settings of settingsToTry) {
        const full = resolvePracticePool(bySubject[subject.id], subject.id, settings);
        expect(poolView(resolvePracticePool(facetBank, subject.id, settings))).toEqual(
          poolView(full),
        );
        if (!full.categories.length) continue;
        const category = full.categories[Math.floor(full.categories.length / 2)].name;
        expect(
          poolView(resolvePracticePool(facetBank, subject.id, { ...settings, category })),
        ).toEqual(
          poolView(
            resolvePracticePool(bySubject[subject.id], subject.id, {
              ...settings,
              category,
            }),
          ),
        );
      }
    }
  });

  it('grades every option of every question the same, and starts the same sessions', () => {
    for (const subject of subjects) {
      const facetBank = new Map(
        facetQuestions(subject.id, facets[subject.id]).map((q) => [q.id, q]),
      );
      const real = multipleChoice(bySubject[subject.id]);
      expect(facetBank.size).toBe(real.length);
      for (const question of real) {
        const facet = facetBank.get(question.id)!;
        expect(facet.options).toHaveLength(question.options.length);
        for (const selected of [undefined, 0, 1, 2, 3]) {
          expect(isQuestionCorrect(facet, selected)).toBe(
            isQuestionCorrect(question, selected),
          );
        }
        expect(getQuestionDisplayCategories(facet)).toEqual(
          getQuestionDisplayCategories(question),
        );
      }
      const ids = subjectReviewQuestions(real, subject.id).map((q) => q.id);
      expect(
        subjectReviewQuestions([...facetBank.values()], subject.id).map((q) => q.id),
      ).toEqual(ids);
      const sample = real.slice(0, 30);
      const noRandom = () => 0.42;
      const session = (list: readonly Question[]) => {
        const drawn = createPracticeSessionFromQuestions(
          list,
          subject.id,
          true,
          noRandom,
        );
        return { ...drawn, id: '' };
      };
      expect(session(sample.map((q) => facetBank.get(q.id)!))).toEqual(session(sample));
    }
  });

  it('gives 考題分析 the same charts, trends and rows', () => {
    const summaries = (subjectId: SubjectId): QuestionSummary[] =>
      multipleChoice(bySubject[subjectId]).map((question) => ({
        id: question.id,
        format: question.format,
        subject: question.subject,
        year: question.year,
        questionNumber: question.questionNumber,
        primaryCategory: question.primaryCategory,
        topic: question.topic,
        tags: question.tags,
        ...(question.relatedLaws?.length ? { relatedLaws: question.relatedLaws } : {}),
        ...(question.fineTopic ? { fineTopic: question.fineTopic } : {}),
        text: question.text,
      }));
    const sortById = <T extends { id: string }>(list: readonly T[]) =>
      [...list].sort((left, right) => left.id.localeCompare(right.id));
    for (const subject of subjects) {
      const stems = JSON.parse(JSON.stringify(buildStems(bySubject[subject.id])));
      const derived = facetSummaries(subject.id, facets[subject.id], stems);
      const real = summaries(subject.id);
      // tags differ on the one question where tags is not [topic]; no screen reads tags.
      const strip = (list: readonly QuestionSummary[]) =>
        sortById(list).map((summary) => ({ ...summary, tags: [] }));
      expect(strip(derived)).toEqual(strip(real));
      const allYears = [...years].reverse();
      for (const dimension of ['category', 'fine-topic'] as const) {
        const series = buildTrendSeries(real, subject.id, allYears, dimension);
        expect(buildTrendSeries(derived, subject.id, allYears, dimension)).toEqual(
          series,
        );
        expect(
          buildForecastRanking(
            buildTrendSeries(derived, subject.id, allYears, dimension),
            allYears,
          ),
        ).toEqual(buildForecastRanking(series, allYears));
      }
      const counted = (list: readonly QuestionSummary[]) =>
        getAnalysis(
          list.map((question) => ({
            primaryCategory: getAnalysisCategory(
              question.subject,
              question.topic,
              question.primaryCategory,
            ),
          })),
        );
      expect(counted(derived)).toEqual(counted(real));
      expect(getLawAnalysis(derived)).toEqual(getLawAnalysis(real));
    }
  });

  it('gives 法規資料庫 the same entries from the summaries', () => {
    const real = subjects.flatMap(({ id }) =>
      multipleChoice(bySubject[id]).map((question) => ({ ...question })),
    ) as unknown as QuestionSummary[];
    const derived = subjects.flatMap(({ id }) =>
      facetSummaries(id, facets[id], buildStems(bySubject[id])),
    );
    expect(buildLawDatabaseEntries(derived)).toEqual(buildLawDatabaseEntries(real));
  });

  it('gives every law question the same 類似考題 rows, in the same order', () => {
    const files = buildSimilarFiles(bySubject.law);
    for (const question of bySubject.law) {
      const topic = getLawQuestionFineTopic(question);
      const expected = bySubject.law
        .filter(
          (other) =>
            other.id !== question.id && topic && getLawQuestionFineTopic(other) === topic,
        )
        .sort(
          (left, right) =>
            right.year - left.year || left.questionNumber - right.questionNumber,
        );
      const rows = topic ? files.get(similarFileKey(topic)) : undefined;
      expect(
        (rows ?? []).filter(([id]) => id !== question.id).map(([id, text]) => [id, text]),
      ).toEqual(expected.map((item) => [item.id, item.text]));
    }
  });
});
