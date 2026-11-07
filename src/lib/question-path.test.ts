import { describe, expect, it } from 'vitest';
import {
  examsAddress,
  examsHref,
  examsPaperStart,
  examsPlace,
  examsQuery,
  examsQuestionHref,
  examsQuestionId,
  examsSlug,
  examsSlugs,
  examsSubjectStart,
  examsTab,
  parseQuestionId,
  subjectsOfQuestionIds,
} from '@/lib/question-path';
import type { PaperIndex } from '@/question-bank/derived-data';

describe('question ids', () => {
  it('reads multiple-choice and essay ids', () => {
    expect(parseQuestionId('env-114-01')).toEqual({
      subject: 'env',
      year: 114,
      format: 'multiple-choice',
      questionNumber: 1,
    });
    expect(parseQuestionId('structure-101-written-03')).toEqual({
      subject: 'structure',
      year: 101,
      format: 'written',
      questionNumber: 3,
    });
    expect(parseQuestionId('law-114')).toBeNull();
  });

  it('lists the subjects of a set of ids in catalog order', () => {
    expect(
      subjectsOfQuestionIds(['structure-101-01', 'law-114-02', 'law-113-01']),
    ).toEqual(['law', 'structure']);
  });
});

describe('考古題討論版 addresses', () => {
  const refs = [
    { id: 'env-114-written-01', format: 'written', subject: 'env', year: 114, questionNumber: 1 },
    { id: 'env-114-01', format: 'multiple-choice', subject: 'env', year: 114, questionNumber: 1 },
    { id: 'env-113-01', format: 'multiple-choice', subject: 'env', year: 113, questionNumber: 1 },
    { id: 'law-114-02', format: 'multiple-choice', subject: 'law', year: 114, questionNumber: 2 },
  ] as const;

  it('gives a question a short address and reads the same question back', () => {
    expect(examsQuestionHref('law-114-03')).toBe('/exams/law/114/3');
    expect(examsQuestionHref('law-114-80')).toBe('/exams/law/114/80');
    expect(examsQuestionHref('env-100-written-01')).toBe('/exams/env/100/written-1');
    for (const id of ['law-114-03', 'law-114-80', 'env-100-written-01']) {
      expect(examsQuestionId(examsSlug(id))).toBe(id);
    }
  });

  it('has no address for something that is not a question id', () => {
    expect(examsQuestionHref('nonsense')).toBe('/exams');
  });

  it('tells the four kinds of address apart', () => {
    expect(examsPlace([])).toEqual({ kind: 'bank' });
    expect(examsPlace(undefined)).toEqual({ kind: 'bank' });
    expect(examsPlace(['law'])).toEqual({ kind: 'subject', subject: 'law' });
    expect(examsPlace('law')).toEqual({ kind: 'subject', subject: 'law' });
    expect(examsPlace(['law', '114'])).toEqual({ kind: 'paper', subject: 'law', year: 114 });
    expect(examsPlace(['law', '114', '3'])).toEqual({
      kind: 'question',
      subject: 'law',
      year: 114,
      questionId: 'law-114-03',
    });
    expect(examsPlace(['env', '100', 'written-1'])).toEqual({
      kind: 'question',
      subject: 'env',
      year: 100,
      questionId: 'env-100-written-01',
    });
  });

  it('shows a question only at an address that names one', () => {
    expect(examsQuestionId(['env', '113'])).toBeUndefined();
    expect(examsQuestionId('env')).toBeUndefined();
    expect(examsQuestionId(undefined)).toBeUndefined();
    expect(examsQuestionId([])).toBeUndefined();
  });

  it('leaves the slug out of the query for /exams itself', () => {
    expect(examsQuery([])).toEqual({});
    expect(examsQuery(['law', '114'])).toEqual({ slug: ['law', '114'] });
  });

  it('adds a tab to the query only when it is not 題目', () => {
    expect(examsQuery(['law', '114', '3'], 'question')).toEqual({ slug: ['law', '114', '3'] });
    expect(examsQuery(['law', '114', '3'], 'notes')).toEqual({
      slug: ['law', '114', '3'],
      tab: 'notes',
    });
  });

  it('reads the tab of an address, and anything else as 題目', () => {
    expect(examsTab('discussion')).toBe('discussion');
    expect(examsTab(['notes', 'discussion'])).toBe('notes');
    expect(examsTab('answers')).toBe('question');
    expect(examsTab(undefined)).toBe('question');
  });

  it('gives an address its tab only on a question', () => {
    expect(examsAddress(['law', '114', '37'], 'notes')).toBe('/exams/law/114/37?tab=notes');
    expect(examsAddress(['law', '114', '37'], 'question')).toBe('/exams/law/114/37');
    expect(examsAddress(['law', '114'], 'discussion')).toBe('/exams/law/114');
    expect(examsAddress([], 'notes')).toBe('/exams');
  });

  it('starts a paper at its first question, 申論第 1 題 when it has written ones', () => {
    const index: PaperIndex = {
      env: [
        [114, 40, 3],
        [113, 40, 2],
      ],
      law: [
        [114, 80, 0],
        [113, 80, 0],
      ],
    };
    expect(examsPaperStart(index, 'env', 114)).toEqual(['env', '114', 'written-1']);
    expect(examsPaperStart(index, 'law', 113)).toEqual(['law', '113', '1']);
    expect(examsPaperStart(index, 'law', 100)).toBeUndefined();
    expect(examsPaperStart(index, 'structure', 114)).toBeUndefined();
    // A subject starts at its newest paper.
    expect(examsSubjectStart(index, 'env')).toEqual(['env', '114', 'written-1']);
    expect(examsSubjectStart(index, 'law')).toEqual(['law', '114', '1']);
    expect(examsSubjectStart(index, 'structure')).toBeUndefined();
  });

  it('lists every subject, paper and question once', () => {
    expect(examsSlugs(refs).map(examsHref)).toEqual([
      '/exams/env',
      '/exams/env/114',
      '/exams/env/113',
      '/exams/law',
      '/exams/law/114',
      '/exams/env/114/written-1',
      '/exams/env/114/1',
      '/exams/env/113/1',
      '/exams/law/114/2',
    ]);
  });
});
