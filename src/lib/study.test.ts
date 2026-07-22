import { describe, expect, it } from 'vitest';
import { questions } from '@/data/questions';
import {
  buildQuiz,
  createDefaultState,
  filterPapers,
  parsePaperFilters,
  parseStoredState,
} from '@/lib/study';

describe('local state validation', () => {
  it('returns defaults for missing, malformed, or incompatible data', () => {
    expect(parseStoredState(null)).toEqual(createDefaultState());
    expect(parseStoredState('{bad json')).toEqual(createDefaultState());
    expect(parseStoredState(JSON.stringify({ version: 1 }))).toEqual(createDefaultState());
  });

  it('accepts a valid v2 state', () => {
    const state = createDefaultState();
    state.difficultQuestionIds = [1, 5];
    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
  });
});

describe('paper filters', () => {
  it('normalizes unsupported URL values to all', () => {
    const filters = parsePaperFilters(
      new URLSearchParams('year=999&subject=unknown&status=maybe'),
    );
    expect(filters).toEqual({ year: 'all', subject: 'all', status: 'all' });
  });

  it('filters wrong answers by year and subject', () => {
    const answers = {
      1: { selected: 0, correct: false, answeredAt: '2026-01-01T00:00:00.000Z' },
      2: { selected: 1, correct: true, answeredAt: '2026-01-01T00:00:00.000Z' },
    };
    const filtered = filterPapers(questions, answers, {
      year: 114,
      subject: 'law',
      status: 'wrong',
    });
    expect(filtered.map((question) => question.id)).toEqual([1]);
  });
});

describe('quiz builder', () => {
  const emptyState = createDefaultState();

  it('supports a reversed year range and caps the requested count', () => {
    const quiz = buildQuiz(
      {
        subject: 'law',
        fromYear: 114,
        toYear: 112,
        count: 20,
        onlyUnanswered: false,
        onlyDifficult: false,
      },
      emptyState,
      () => 0.5,
    );
    expect(quiz).toHaveLength(3);
    expect(quiz.every((question) => question.subject === 'law')).toBe(true);
    expect(quiz.every((question) => question.year >= 112 && question.year <= 114)).toBe(true);
  });

  it('returns an empty quiz when no question matches', () => {
    const quiz = buildQuiz(
      {
        subject: 'all',
        fromYear: 102,
        toYear: 114,
        count: 5,
        onlyUnanswered: false,
        onlyDifficult: true,
      },
      emptyState,
      () => 0.5,
    );
    expect(quiz).toEqual([]);
  });

  it('honors unanswered and difficult filters together', () => {
    const state = createDefaultState();
    state.difficultQuestionIds = [1, 2];
    state.answers[1] = {
      selected: 1,
      correct: true,
      answeredAt: '2026-01-01T00:00:00.000Z',
    };
    const quiz = buildQuiz(
      {
        subject: 'all',
        fromYear: 102,
        toYear: 114,
        count: 5,
        onlyUnanswered: true,
        onlyDifficult: true,
      },
      state,
      () => 0.5,
    );
    expect(quiz.map((question) => question.id)).toEqual([2]);
  });
});
