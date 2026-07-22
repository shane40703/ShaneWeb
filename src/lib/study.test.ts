import { describe, expect, it } from 'vitest';
import { loadAllQuestions } from '@/server/question-bank.server';
import {
  createAttempt,
  createDefaultState,
  formatDuration,
  getAnalysis,
  isQuestionCorrect,
  migrateLegacyState,
  migrateV3State,
  parseStoredState,
} from '@/lib/study';

const questions = await loadAllQuestions();

function firstAcceptedAnswer(question: (typeof questions)[number]) {
  return question.answerKey.kind === 'accepted' ? question.answerKey.options[0] : 0;
}

describe('question data', () => {
  it('uses unique canonical ids and valid primary categories', () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    questions.forEach((question) => {
      expect(question.id).toBe(
        `${question.subject}-${question.year}-${String(question.questionNumber).padStart(2, '0')}`,
      );
      expect(question.year).toBeGreaterThanOrEqual(102);
      expect(question.year).toBeLessThanOrEqual(114);
      if (question.answerKey.kind === 'accepted') {
        expect(question.answerKey.options.length).toBeGreaterThan(0);
        question.answerKey.options.forEach((answer) => {
          expect(answer).toBeGreaterThanOrEqual(0);
          expect(answer).toBeLessThan(question.options.length);
        });
      }
      expect(question.primaryCategory.length).toBeGreaterThan(0);
    });
    expect(questions).toHaveLength(100);
  });
});

describe('local state validation', () => {
  it('returns defaults for missing, malformed, or incompatible data', () => {
    expect(parseStoredState(null)).toEqual(createDefaultState());
    expect(parseStoredState('{bad json')).toEqual(createDefaultState());
    expect(parseStoredState(JSON.stringify({ version: 2 }))).toEqual(createDefaultState());
  });

  it('accepts a valid v4 state', () => {
    const state = createDefaultState();
    state.difficultQuestionIds = ['law-114-01'];
    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
  });

  it('migrates v3 while removing state tied to replaced official questions', () => {
    const migrated = migrateV3State(
      JSON.stringify({
        version: 3,
        answers: {
          'law-114-01': {
            selected: 1,
            correct: true,
            answeredAt: '2026-01-01T00:00:00.000Z',
          },
          'env-114-01': {
            selected: 1,
            correct: true,
            answeredAt: '2026-01-01T00:00:00.000Z',
          },
        },
        difficultQuestionIds: ['law-114-01', 'env-114-01'],
        attempts: [],
        notes: { 'law-114-01': '舊題筆記', 'env-114-01': '保留筆記' },
        discussionPosts: [],
      }),
    );
    expect(migrated.version).toBe(4);
    expect(migrated.answers['law-114-01']).toBeUndefined();
    expect(migrated.answers['env-114-01']?.correct).toBe(true);
    expect(migrated.difficultQuestionIds).toEqual(['env-114-01']);
    expect(migrated.notes).toEqual({ 'env-114-01': '保留筆記' });
  });

  it('migrates v2 answers and difficult ids without interface preferences', () => {
    const migrated = migrateLegacyState(
      JSON.stringify({
        version: 2,
        answers: {
          2: { selected: 1, correct: true, answeredAt: '2026-01-01T00:00:00.000Z' },
        },
        difficultQuestionIds: [1, 5],
        preferences: { theme: 'dark' },
      }),
    );
    expect(migrated.answers['env-114-01']?.correct).toBe(true);
    expect(migrated.difficultQuestionIds).toEqual(['law-113-01']);
    expect(migrated).not.toHaveProperty('preferences');
  });
});

describe('result helpers', () => {
  it('calculates complete submission totals and duration formatting', () => {
    const source = questions.slice(0, 3);
    const attempt = createAttempt({
      mode: 'paper',
      source,
      answers: { [source[0].id]: firstAcceptedAnswer(source[0]), [source[1].id]: 0 },
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 65,
    });
    expect(attempt.correctCount).toBe(1);
    expect(attempt.wrongCount).toBe(1);
    expect(attempt.unansweredCount).toBe(1);
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('accepts every corrected answer and awards all-credit questions without a selection', () => {
    const corrected = questions.find((question) => question.id === 'construction-114-49');
    expect(corrected).toBeDefined();
    expect(isQuestionCorrect(corrected!, 0)).toBe(true);
    expect(isQuestionCorrect(corrected!, 1)).toBe(true);
    expect(isQuestionCorrect(corrected!, 2)).toBe(false);

    const allCredit = { ...corrected!, id: 'all-credit', answerKey: { kind: 'all-credit' as const } };
    const attempt = createAttempt({
      mode: 'paper',
      source: [allCredit],
      answers: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 1,
    });
    expect(attempt.correctCount).toBe(1);
    expect(attempt.wrongCount).toBe(0);
    expect(attempt.unansweredCount).toBe(0);
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
