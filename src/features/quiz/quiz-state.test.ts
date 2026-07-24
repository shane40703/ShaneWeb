import { describe, expect, it } from 'vitest';
import { quizProgressReducer, type QuizProgressByQuestion } from './quiz-state';

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
});
