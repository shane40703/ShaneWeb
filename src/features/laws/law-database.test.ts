import { describe, expect, it } from 'vitest';
import type { QuestionSummary } from '@/lib/types';
import { buildLawDatabaseEntries, lawSearchUrl } from './law-database';

function question(
  id: string,
  subject: QuestionSummary['subject'],
  relatedLaws?: string[],
): QuestionSummary {
  return {
    id,
    subject,
    year: 114,
    questionNumber: 1,
    primaryCategory: '建築法',
    topic: '建築法',
    tags: [],
    relatedLaws,
    text: id,
    path: `/questions/${subject}/114/01`,
  };
}

describe('buildLawDatabaseEntries', () => {
  it('counts law-subject citations, skips unknown or repealed tags, and sorts by count then name', () => {
    const entries = buildLawDatabaseEntries([
      question('a', 'law', ['建築法', '建築技術規則']),
      question('b', 'law', ['建築技術規則', '???']),
      question('c', 'law', ['廢止', '公寓大廈管理條例']),
      question('d', 'law'),
      question('e', 'construction', ['建築技術規則']),
    ]);

    expect(entries).toEqual([
      { name: '建築技術規則', questionCount: 2, linkable: true },
      { name: '公寓大廈管理條例', questionCount: 1, linkable: true },
      { name: '建築法', questionCount: 1, linkable: true },
    ]);
  });

  it('builds a national laws database search link for any law name', () => {
    expect(lawSearchUrl('建築法')).toBe(
      'https://law.moj.gov.tw/Law/LawSearchResult.aspx?ty=ONEBAR&kw=%E5%BB%BA%E7%AF%89%E6%B3%95',
    );
  });
});
