import { describe, expect, it } from 'vitest';
import { questions } from '@/data/questions';
import {
  buildQuiz,
  createAttempt,
  createDefaultState,
  formatDuration,
  getAnalysis,
  migrateLegacyState,
  parseStoredState,
} from '@/lib/study';

describe('question data', () => {
  it('uses unique canonical ids and valid primary categories', () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    questions.forEach((question) => {
      expect(question.id).toBe(
        `${question.subject}-${question.year}-${String(question.questionNumber).padStart(2, '0')}`,
      );
      expect(question.year).toBeGreaterThanOrEqual(102);
      expect(question.year).toBeLessThanOrEqual(114);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThan(question.options.length);
      expect(question.primaryCategory.length).toBeGreaterThan(0);
    });
  });
});

describe('local state validation', () => {
  it('returns defaults for missing, malformed, or incompatible data', () => {
    expect(parseStoredState(null)).toEqual(createDefaultState());
    expect(parseStoredState('{bad json')).toEqual(createDefaultState());
    expect(parseStoredState(JSON.stringify({ version: 2 }))).toEqual(createDefaultState());
  });

  it('accepts a valid v3 state', () => {
    const state = createDefaultState();
    state.difficultQuestionIds = ['law-114-01'];
    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
  });

  it('migrates v2 answers and difficult ids without interface preferences', () => {
    const migrated = migrateLegacyState(
      JSON.stringify({
        version: 2,
        answers: {
          1: { selected: 1, correct: true, answeredAt: '2026-01-01T00:00:00.000Z' },
        },
        difficultQuestionIds: [1, 5],
        preferences: { theme: 'dark' },
      }),
    );
    expect(migrated.answers['law-114-01']?.correct).toBe(true);
    expect(migrated.difficultQuestionIds).toEqual(['law-114-01', 'law-113-01']);
    expect(migrated).not.toHaveProperty('preferences');
  });
});

describe('quiz builder and result helpers', () => {
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
  });

  it('honors unanswered and difficult filters together', () => {
    const state = createDefaultState();
    state.difficultQuestionIds = ['law-114-01', 'env-114-01'];
    state.answers['law-114-01'] = {
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
    expect(quiz.map((question) => question.id)).toEqual(['env-114-01']);
  });

  it('calculates complete submission totals and duration formatting', () => {
    const source = questions.slice(0, 3);
    const attempt = createAttempt({
      mode: 'random',
      source,
      answers: { [source[0].id]: source[0].answer, [source[1].id]: 0 },
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 65,
    });
    expect(attempt.correctCount).toBe(1);
    expect(attempt.wrongCount).toBe(1);
    expect(attempt.unansweredCount).toBe(1);
    expect(formatDuration(3661)).toBe('01:01:01');
  });
});

describe('analysis', () => {
  it('counts each question once through its primary category', () => {
    const source = questions.filter((question) => question.subject === 'law');
    const analysis = getAnalysis(source);
    expect(analysis.reduce((sum, item) => sum + item.count, 0)).toBe(source.length);
    expect(analysis.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
  });
});
