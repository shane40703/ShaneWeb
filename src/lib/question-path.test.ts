import { describe, expect, it } from 'vitest';
import {
  parseQuestionId,
  questionPath,
  questionPathFromId,
} from '@/lib/question-path';

describe('question paths', () => {
  it('keeps existing multiple-choice ids and routes unchanged', () => {
    expect(parseQuestionId('env-114-01')).toEqual({
      subject: 'env',
      year: 114,
      format: 'multiple-choice',
      questionNumber: 1,
    });
    expect(questionPath('env', 114, 1)).toBe('/questions/env/114/01');
  });

  it('round-trips essay ids and routes', () => {
    expect(parseQuestionId('structure-101-written-03')).toEqual({
      subject: 'structure',
      year: 101,
      format: 'written',
      questionNumber: 3,
    });
    expect(questionPath('structure', 101, 3, 'written')).toBe(
      '/questions/structure/101/written-03',
    );
    expect(questionPathFromId('structure-101-written-03')).toBe(
      '/questions/structure/101/written-03',
    );
  });
});
