import { describe, expect, it } from 'vitest';
import { drawWrongQuestions } from './wrong-weighted-draw';

const questions = [{ id: 'once' }, { id: 'four-times' }, { id: 'twice' }];
const counts = { once: 1, 'four-times': 4, twice: 2 };

describe('drawWrongQuestions', () => {
  it('draws each candidate in proportion to its wrong count', () => {
    expect(drawWrongQuestions(questions, counts, 1, () => 0)).toEqual([questions[0]]);
    expect(drawWrongQuestions(questions, counts, 1, () => 0.15)).toEqual([questions[1]]);
    expect(drawWrongQuestions(questions, counts, 1, () => 0.8)).toEqual([questions[2]]);
    // Evenly spaced values cover the probability intervals without a flaky random test.
    const frequency = Array.from({ length: 700 }, (_, index) =>
      drawWrongQuestions(questions, counts, 1, () => (index + 0.5) / 700)[0].id);
    expect(frequency.filter((id) => id === 'once')).toHaveLength(100);
    expect(frequency.filter((id) => id === 'four-times')).toHaveLength(400);
    expect(frequency.filter((id) => id === 'twice')).toHaveLength(200);
  });

  it('samples without replacement and never mutates the source', () => {
    const result = drawWrongQuestions(questions, counts, 10, () => 0.5);
    expect(result).toEqual([questions[1], questions[2], questions[0]]);
    expect(new Set(result.map((question) => question.id)).size).toBe(3);
    expect(questions.map((question) => question.id)).toEqual(['once', 'four-times', 'twice']);
    expect(drawWrongQuestions(questions, counts, 0)).toEqual([]);
  });

  it('keeps a nonzero chance for missing or invalid counts', () => {
    expect(drawWrongQuestions(questions, { once: 0, 'four-times': Number.NaN, twice: -1 }, 1, () => 0.5))
      .toEqual([questions[1]]);
    expect(drawWrongQuestions(questions, {}, 1, () => 0.99)).toEqual([questions[2]]);
  });
});
