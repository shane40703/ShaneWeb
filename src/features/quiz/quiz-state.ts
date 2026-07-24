import type { QuestionId } from '@/lib/types';

export interface QuizQuestionProgress {
  selected?: number;
  elapsedSeconds: number;
  startedAt: string;
}

export type QuizProgressByQuestion = Partial<Record<QuestionId, QuizQuestionProgress>>;

export type QuizProgressAction =
  | { type: 'visit-question'; questionId: QuestionId; startedAt: string }
  | {
      type: 'select-answer';
      questionId: QuestionId;
      selected: number;
      startedAt: string;
    }
  | { type: 'tick-question'; questionId: QuestionId; startedAt: string };

function createQuestionProgress(startedAt: string): QuizQuestionProgress {
  return {
    elapsedSeconds: 0,
    startedAt,
  };
}

function getQuestionProgress(
  state: QuizProgressByQuestion,
  questionId: QuestionId,
  startedAt: string,
) {
  return state[questionId] ?? createQuestionProgress(startedAt);
}

export function quizProgressReducer(
  state: QuizProgressByQuestion,
  action: QuizProgressAction,
): QuizProgressByQuestion {
  const current = getQuestionProgress(state, action.questionId, action.startedAt);

  switch (action.type) {
    case 'visit-question':
      return state[action.questionId]
        ? state
        : { ...state, [action.questionId]: current };
    case 'select-answer':
      if (current.selected === action.selected) return state;
      return {
        ...state,
        [action.questionId]: { ...current, selected: action.selected },
      };
    case 'tick-question':
      return {
        ...state,
        [action.questionId]: {
          ...current,
          elapsedSeconds: current.elapsedSeconds + 1,
        },
      };
  }
}
