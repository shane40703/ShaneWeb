import type { AppStateV2, HistoryEntry, Preferences } from '@/lib/types';
import { createDefaultState } from '@/lib/study';

export type AppAction =
  | { type: 'hydrate'; state: AppStateV2 }
  | { type: 'toggle-difficult'; questionId: number }
  | { type: 'record-answer'; entry: HistoryEntry }
  | { type: 'update-preferences'; preferences: Partial<Preferences> }
  | { type: 'reset' };

export function appReducer(state: AppStateV2, action: AppAction): AppStateV2 {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'toggle-difficult': {
      const exists = state.difficultQuestionIds.includes(action.questionId);
      return {
        ...state,
        difficultQuestionIds: exists
          ? state.difficultQuestionIds.filter((id) => id !== action.questionId)
          : [...state.difficultQuestionIds, action.questionId],
      };
    }
    case 'record-answer':
      if (state.history.some((entry) => entry.id === action.entry.id)) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.entry.questionId]: {
            selected: action.entry.selected,
            correct: action.entry.correct,
            answeredAt: action.entry.answeredAt,
          },
        },
        history: [action.entry, ...state.history].slice(0, 100),
      };
    case 'update-preferences':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.preferences },
      };
    case 'reset':
      return createDefaultState();
  }
}
