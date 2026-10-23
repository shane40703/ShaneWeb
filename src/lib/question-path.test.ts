import { describe, expect, it } from 'vitest';
import { parseQuestionId, subjectsOfQuestionIds } from '@/lib/question-path';

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
