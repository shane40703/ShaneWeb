import { describe, expect, it } from 'vitest';
import {
  examsHref,
  examsQuestionHref,
  examsQuestionId,
  examsSlug,
  examsSlugs,
  parseQuestionId,
  subjectsOfQuestionIds,
} from '@/lib/question-path';

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
      expect(examsQuestionId(examsSlug(id), [])).toBe(id);
    }
  });

  it('has no address for something that is not a question id', () => {
    expect(examsQuestionHref('nonsense')).toBe('/exams');
  });

  it('opens a paper or a subject on its first question, newest paper first', () => {
    expect(examsQuestionId(['env', '113'], refs)).toBe('env-113-01');
    expect(examsQuestionId(['env', '114'], refs)).toBe('env-114-written-01');
    expect(examsQuestionId('env', refs)).toBe('env-114-written-01');
    expect(examsQuestionId(undefined, refs)).toBeUndefined();
    expect(examsQuestionId([], refs)).toBeUndefined();
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
