import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  composeQuizProgress,
  paperProgressScope,
  parseStoredQuizProgress,
  QUIZ_PROGRESS_STORAGE_KEY,
  quizProgressReducer,
  writeQuizProgress,
  type QuizProgressByQuestion,
} from './mock-exam-progress';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('quizProgressReducer', () => {
  it('records a visit once and keeps each answer by question id', () => {
    let state: QuizProgressByQuestion = {};
    state = quizProgressReducer(state, {
      type: 'visit-question',
      questionId: 'law-114-01',
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'law-114-01',
      selected: 1,
      startedAt: '2026-07-23T00:00:01.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'law-114-02',
      selected: 3,
      startedAt: '2026-07-23T00:01:00.000Z',
    });
    const visitedAgain = quizProgressReducer(state, {
      type: 'visit-question',
      questionId: 'law-114-01',
      startedAt: '2026-07-23T00:02:00.000Z',
    });

    expect(visitedAgain).toBe(state);
    expect(state).toEqual({
      'law-114-01': {
        selected: 1,
        elapsedSeconds: 0,
        startedAt: '2026-07-23T00:00:00.000Z',
      },
      'law-114-02': {
        selected: 3,
        elapsedSeconds: 0,
        startedAt: '2026-07-23T00:01:00.000Z',
      },
    });
  });

  it('allows changing an answer before 交卷', () => {
    const answered = quizProgressReducer(
      {},
      { type: 'select-answer', questionId: 'q', selected: 1, startedAt: 'a' },
    );
    const changed = quizProgressReducer(answered, {
      type: 'select-answer',
      questionId: 'q',
      selected: 2,
      startedAt: 'b',
    });
    expect(changed.q?.selected).toBe(2);
    expect(
      quizProgressReducer(changed, {
        type: 'select-answer',
        questionId: 'q',
        selected: 2,
        startedAt: 'c',
      }),
    ).toBe(changed);
  });

  it('keeps struck-out options with the question and protects the selected answer', () => {
    let state: QuizProgressByQuestion = {};
    state = quizProgressReducer(state, {
      type: 'toggle-eliminated-option',
      questionId: 'q',
      option: 2,
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'q',
      selected: 1,
      startedAt: '2026-07-23T00:00:01.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'toggle-eliminated-option',
      questionId: 'q',
      option: 1,
      startedAt: '2026-07-23T00:00:02.000Z',
    });
    expect(state.q).toEqual({
      selected: 1,
      eliminatedOptions: [2],
      elapsedSeconds: 0,
      startedAt: '2026-07-23T00:00:00.000Z',
    });

    state = quizProgressReducer(state, {
      type: 'toggle-eliminated-option',
      questionId: 'q',
      option: 2,
      startedAt: '2026-07-23T00:00:03.000Z',
    });
    expect(state.q?.eliminatedOptions).toBeUndefined();
  });
});

describe('paper draft storage', () => {
  const progress = {
    'law-114-01': {
      selected: 1,
      elapsedSeconds: 4,
      startedAt: '2026-07-23T00:00:00.000Z',
    },
  };

  it('restores drafts and drops entries that no longer parse', () => {
    const stored = JSON.stringify({
      version: 2,
      scopes: {
        'paper:law:114': {
          'law-114-01': {
            selected: 2,
            elapsedSeconds: 30,
            startedAt: 'a',
            updatedAt: 'b',
          },
          'law-114-02': { elapsedSeconds: 5, startedAt: 'c' },
          'law-114-03': { selected: 'B', elapsedSeconds: 5, startedAt: 'd' },
          'law-114-04': null,
        },
        empty: { broken: null },
      },
    });

    expect(parseStoredQuizProgress(stored)).toEqual({
      'paper:law:114': {
        'law-114-01': { selected: 2, elapsedSeconds: 30, startedAt: 'a', updatedAt: 'b' },
        'law-114-02': { elapsedSeconds: 5, startedAt: 'c' },
      },
    });
    expect(parseStoredQuizProgress(null)).toEqual({});
    expect(parseStoredQuizProgress('{bad json')).toEqual({});
    expect(parseStoredQuizProgress('[]')).toEqual({});
    expect(parseStoredQuizProgress(JSON.stringify({ 'law-114-01': progress }))).toEqual(
      {},
    );
  });

  it('keeps one draft per paper, the original 歷屆試題 scope', () => {
    expect(paperProgressScope('law', 114)).toBe('paper:law:114');
    writeQuizProgress(paperProgressScope('law', 114), progress);
    writeQuizProgress(paperProgressScope('env', 113), progress);
    writeQuizProgress(paperProgressScope('law', 114), {});

    expect(JSON.parse(window.localStorage.getItem(QUIZ_PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 2,
      scopes: { 'paper:env:113': progress },
    });
  });

  it('drops the drafts of the retired random and single-question pages on the next save', () => {
    const raw = JSON.stringify({
      version: 2,
      scopes: {
        'random:session:law-114-01': progress,
        'single:law-114-01': progress,
        'paper:law:113': progress,
      },
    });

    expect(JSON.parse(composeQuizProgress(raw, 'paper:law:114', progress))).toEqual({
      version: 2,
      scopes: { 'paper:law:113': progress, 'paper:law:114': progress },
    });
  });

  it('returns the storage failure so the page can report it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(writeQuizProgress('paper:law:114', progress)).toBe('quota-exceeded');
  });
});
