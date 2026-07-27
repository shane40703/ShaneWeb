import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createQuizProgressScope,
  createQuizQuestionSearch,
  parseStoredQuizProgress,
  QUIZ_PROGRESS_STORAGE_KEY,
  readQuizProgress,
  quizProgressReducer,
  scopedQuizProgressReducer,
  writeQuizProgress,
  type QuizProgressByQuestion,
} from './quiz-state';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('quizProgressReducer', () => {
  it('records selection and time independently by question id', () => {
    let state: QuizProgressByQuestion = {};

    state = quizProgressReducer(state, {
      type: 'visit-question',
      questionId: 'construction-114-01',
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'construction-114-01',
      selected: 1,
      startedAt: '2026-07-23T00:00:01.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'tick-question',
      questionId: 'construction-114-01',
      startedAt: '2026-07-23T00:00:01.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'visit-question',
      questionId: 'construction-114-49',
      startedAt: '2026-07-23T00:01:00.000Z',
    });

    expect(state['construction-114-01']).toEqual({
      selected: 1,
      elapsedSeconds: 1,
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    expect(state['construction-114-49']).toEqual({
      elapsedSeconds: 0,
      startedAt: '2026-07-23T00:01:00.000Z',
    });
  });

  it('keeps each draft when moving back and forth between questions', () => {
    let state: QuizProgressByQuestion = {};

    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'question-1',
      selected: 0,
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'question-2',
      selected: 3,
      startedAt: '2026-07-23T00:01:00.000Z',
    });

    expect(state['question-1']?.selected).toBe(0);
    expect(state['question-2']?.selected).toBe(3);
  });

  it('allows changing an answer before the whole quiz is graded', () => {
    let state: QuizProgressByQuestion = {};
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'question-1',
      selected: 1,
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'question-1',
      selected: 2,
      startedAt: '2026-07-23T00:00:02.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'tick-question',
      questionId: 'question-1',
      startedAt: '2026-07-23T00:00:02.000Z',
    });

    expect(state['question-1']?.selected).toBe(2);
    expect(state['question-1']?.elapsedSeconds).toBe(1);
  });

  it('keeps eliminated options with the question draft and protects the selected answer', () => {
    let state: QuizProgressByQuestion = {};
    state = quizProgressReducer(state, {
      type: 'toggle-eliminated-option',
      questionId: 'question-1',
      option: 2,
      startedAt: '2026-07-23T00:00:00.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'select-answer',
      questionId: 'question-1',
      selected: 1,
      startedAt: '2026-07-23T00:00:01.000Z',
    });
    state = quizProgressReducer(state, {
      type: 'toggle-eliminated-option',
      questionId: 'question-1',
      option: 1,
      startedAt: '2026-07-23T00:00:02.000Z',
    });

    expect(state['question-1']).toEqual({
      selected: 1,
      eliminatedOptions: [2],
      elapsedSeconds: 0,
      startedAt: '2026-07-23T00:00:00.000Z',
    });

    state = quizProgressReducer(state, {
      type: 'toggle-eliminated-option',
      questionId: 'question-1',
      option: 2,
      startedAt: '2026-07-23T00:00:03.000Z',
    });
    expect(state['question-1']?.eliminatedOptions).toBeUndefined();
  });
});

describe('quiz progress persistence', () => {
  it('restores scoped drafts and drops entries that no longer parse', () => {
    const stored = JSON.stringify({
      version: 2,
      scopes: {
        'paper:law:114': {
          'law-114-01': {
            selected: 2,
            elapsedSeconds: 30,
            startedAt: '2026-07-23T00:00:00.000Z',
          },
          'law-114-02': {
            elapsedSeconds: 5,
            startedAt: '2026-07-23T00:01:00.000Z',
          },
          'law-114-03': {
            selected: 'B',
            elapsedSeconds: 5,
            startedAt: '2026-07-23T00:02:00.000Z',
          },
          'law-114-04': null,
        },
        empty: {
          broken: null,
        },
      },
    });

    expect(parseStoredQuizProgress(stored)).toEqual({
      'paper:law:114': {
        'law-114-01': {
          selected: 2,
          elapsedSeconds: 30,
          startedAt: '2026-07-23T00:00:00.000Z',
        },
        'law-114-02': {
          elapsedSeconds: 5,
          startedAt: '2026-07-23T00:01:00.000Z',
        },
      },
    });
  });

  it('returns an empty draft set for missing, malformed, or legacy storage', () => {
    expect(parseStoredQuizProgress(null)).toEqual({});
    expect(parseStoredQuizProgress('{bad json')).toEqual({});
    expect(parseStoredQuizProgress('[]')).toEqual({});
    expect(
      parseStoredQuizProgress(
        JSON.stringify({
          'law-114-01': {
            selected: 2,
            elapsedSeconds: 30,
            startedAt: '2026-07-23T00:00:00.000Z',
          },
        }),
      ),
    ).toEqual({});
  });

  it('clears only the submitted questions so other drafts survive', () => {
    const state = {
      'law-114-01': {
        selected: 1,
        elapsedSeconds: 4,
        startedAt: '2026-07-23T00:00:00.000Z',
      },
      'env-114-01': {
        selected: 0,
        elapsedSeconds: 9,
        startedAt: '2026-07-23T00:05:00.000Z',
      },
    };

    expect(
      quizProgressReducer(state, {
        type: 'clear-questions',
        questionIds: ['law-114-01'],
      }),
    ).toEqual({
      'env-114-01': {
        selected: 0,
        elapsedSeconds: 9,
        startedAt: '2026-07-23T00:05:00.000Z',
      },
    });
  });

  it('keeps the same question independent across random sessions', () => {
    const firstScope = createQuizProgressScope({
      mode: 'random',
      questionIds: ['law-114-01', 'law-113-01'],
      sessionId: 'session-one',
    });
    const secondScope = createQuizProgressScope({
      mode: 'random',
      questionIds: ['law-114-01', 'law-113-01'],
      sessionId: 'session-two',
    });
    expect(firstScope).not.toBeNull();
    expect(secondScope).not.toBeNull();

    const firstProgress = {
      'law-114-01': {
        selected: 1,
        elapsedSeconds: 4,
        startedAt: '2026-07-23T00:00:00.000Z',
      },
    };
    const secondProgress = {
      'law-114-01': {
        selected: 3,
        elapsedSeconds: 1,
        startedAt: '2026-07-23T01:00:00.000Z',
      },
    };

    expect(writeQuizProgress(firstScope!, firstProgress)).toBe('saved');
    expect(writeQuizProgress(secondScope!, secondProgress)).toBe('saved');
    expect(readQuizProgress(firstScope!)).toEqual(firstProgress);
    expect(readQuizProgress(secondScope!)).toEqual(secondProgress);
  });

  it('removes an empty submitted scope without deleting another draft', () => {
    const paperScope = createQuizProgressScope({
      mode: 'paper',
      subject: 'law',
      year: 114,
    })!;
    const singleScope = createQuizProgressScope({
      mode: 'single',
      questionId: 'law-114-01',
    })!;
    const progress = {
      'law-114-01': {
        selected: 1,
        elapsedSeconds: 4,
        startedAt: '2026-07-23T00:00:00.000Z',
      },
    };

    writeQuizProgress(paperScope, progress);
    writeQuizProgress(singleScope, progress);
    writeQuizProgress(paperScope, {});

    expect(readQuizProgress(paperScope)).toEqual({});
    expect(readQuizProgress(singleScope)).toEqual(progress);
    expect(JSON.parse(window.localStorage.getItem(QUIZ_PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 2,
      scopes: {
        [singleScope]: progress,
      },
    });
  });

  it('returns the storage failure so the quiz UI can report it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(
      writeQuizProgress('paper:law:114', {
        'law-114-01': {
          selected: 1,
          elapsedSeconds: 4,
          startedAt: '2026-07-23T00:00:00.000Z',
        },
      }),
    ).toBe('quota-exceeded');
  });
});

describe('quiz progress scopes and navigation', () => {
  it('uses stable but separate scopes for paper, single, and random quizzes', () => {
    expect(
      createQuizProgressScope({ mode: 'paper', subject: 'law', year: 114 }),
    ).toBe('paper:law:114');
    expect(
      createQuizProgressScope({ mode: 'single', questionId: 'law-114-01' }),
    ).toBe('single:law-114-01');
    expect(
      createQuizProgressScope({
        mode: 'random',
        questionIds: ['law-114-01'],
        sessionId: null,
      }),
    ).toBeNull();
    expect(
      createQuizProgressScope({
        mode: 'random',
        questionIds: ['law-114-01'],
        sessionId: 'draw-1',
      }),
    ).toBe('random:draw-1:law-114-01');
  });

  it('keeps every original random id and the session in question links', () => {
    expect(
      createQuizQuestionSearch({
        mode: 'random',
        questionIds: ['law-114-01', 'law-113-02', 'law-112-03'],
        sessionId: 'draw/1',
      }),
    ).toBe(
      '?mode=random&questions=law-114-01%2Claw-113-02%2Claw-112-03&quizSession=draw%2F1',
    );
  });

  it('ignores a late update from a quiz scope that is no longer active', () => {
    const state = {
      scope: 'paper:law:114',
      progress: {
        'law-114-01': {
          elapsedSeconds: 1,
          startedAt: '2026-07-23T00:00:00.000Z',
        },
      },
    };

    expect(
      scopedQuizProgressReducer(state, {
        type: 'update-scope',
        scope: 'random:draw-1:law-114-01',
        action: {
          type: 'tick-question',
          questionId: 'law-114-01',
          startedAt: '2026-07-23T00:00:00.000Z',
        },
      }),
    ).toBe(state);
  });
});
