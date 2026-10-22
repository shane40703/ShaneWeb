import type { QuestionSummary } from '@/lib/types';

export interface LawDatabaseEntry {
  name: string;
  questionCount: number;
  linkable: boolean;
}

const searchUrl = 'https://law.moj.gov.tw/Law/LawSearchResult.aspx?ty=ONEBAR&kw=';

export function lawSearchUrl(name: string) {
  return `${searchUrl}${encodeURIComponent(name)}`;
}

/** Counts how often each law is cited by law-subject questions, most cited first. */
export function buildLawDatabaseEntries(
  questions: readonly QuestionSummary[],
): LawDatabaseEntry[] {
  const counts = new Map<string, number>();
  questions
    .filter((question) => question.subject === 'law')
    .flatMap((question) => question.relatedLaws ?? [])
    .filter((law) => law !== '???' && law !== '廢止')
    .forEach((law) => counts.set(law, (counts.get(law) ?? 0) + 1));

  return [...counts]
    .map(([name, questionCount]) => ({
      name,
      questionCount,
      linkable: true,
    }))
    .sort(
      (left, right) =>
        right.questionCount - left.questionCount ||
        left.name.localeCompare(right.name, 'zh-Hant'),
    );
}
