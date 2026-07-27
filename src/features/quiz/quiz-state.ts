import { readStoredValue, writeStoredValue } from '@/lib/storage';
import type { QuestionId } from '@/lib/types';

export const QUIZ_PROGRESS_STORAGE_KEY = 'shaneweb:quiz-progress';
const QUIZ_PROGRESS_STORAGE_VERSION = 2;

export interface QuizQuestionProgress {
  selected?: number;
  eliminatedOptions?: number[];
  elapsedSeconds: number;
  startedAt: string;
}

export type QuizProgressByQuestion = Partial<Record<QuestionId, QuizQuestionProgress>>;
export type QuizProgressByScope = Record<string, QuizProgressByQuestion>;

export function getQuizElapsedSeconds(
  progress: QuizProgressByQuestion,
  questionIds: readonly QuestionId[],
) {
  return questionIds.reduce(
    (total, questionId) =>
      total + Math.max(0, progress[questionId]?.elapsedSeconds ?? 0),
    0,
  );
}

export type QuizProgressAction =
  | { type: 'visit-question'; questionId: QuestionId; startedAt: string }
  | {
      type: 'select-answer';
      questionId: QuestionId;
      selected: number;
      startedAt: string;
    }
  | {
      type: 'toggle-eliminated-option';
      questionId: QuestionId;
      option: number;
      startedAt: string;
    }
  | { type: 'tick-question'; questionId: QuestionId; startedAt: string }
  | { type: 'clear-questions'; questionIds: readonly QuestionId[] };

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
  if (action.type === 'clear-questions') {
    const cleared = new Set(action.questionIds);
    return Object.fromEntries(
      Object.entries(state).filter(([questionId]) => !cleared.has(questionId)),
    );
  }

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
    case 'toggle-eliminated-option': {
      if (current.selected === action.option) return state;
      const eliminatedOptions = current.eliminatedOptions ?? [];
      const alreadyEliminated = eliminatedOptions.includes(action.option);
      const nextEliminatedOptions = alreadyEliminated
        ? eliminatedOptions.filter((option) => option !== action.option)
        : [...eliminatedOptions, action.option].sort((left, right) => left - right);
      const nextProgress = { ...current };
      if (nextEliminatedOptions.length) {
        nextProgress.eliminatedOptions = nextEliminatedOptions;
      } else {
        delete nextProgress.eliminatedOptions;
      }
      return { ...state, [action.questionId]: nextProgress };
    }
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

export interface ScopedQuizProgressState {
  scope: string | null;
  progress: QuizProgressByQuestion;
}

export type ScopedQuizProgressAction =
  | {
      type: 'restore-scope';
      scope: string;
      progress: QuizProgressByQuestion;
    }
  | {
      type: 'update-scope';
      scope: string;
      action: QuizProgressAction;
    };

/**
 * Ignores work from a page whose scope is no longer active. This matters when
 * a route change and the old question's final timer tick land in the same
 * React batch.
 */
export function scopedQuizProgressReducer(
  state: ScopedQuizProgressState,
  action: ScopedQuizProgressAction,
): ScopedQuizProgressState {
  if (action.type === 'restore-scope') {
    return { scope: action.scope, progress: action.progress };
  }
  if (state.scope !== action.scope) return state;

  const progress = quizProgressReducer(state.progress, action.action);
  return progress === state.progress ? state : { ...state, progress };
}

export type QuizProgressScopeInput =
  | {
      mode: 'paper';
      subject: string;
      year: number;
    }
  | {
      mode: 'single';
      questionId: QuestionId;
    }
  | {
      mode: 'random';
      questionIds: readonly QuestionId[];
      sessionId: string | null;
    };

/**
 * A question can appear in several kinds of quiz. The scope keeps those
 * drafts independent while remaining deterministic across a reload.
 */
export function createQuizProgressScope(input: QuizProgressScopeInput): string | null {
  if (input.mode === 'paper') return `paper:${input.subject}:${input.year}`;
  if (input.mode === 'single') return `single:${input.questionId}`;
  if (!input.sessionId || !input.questionIds.length) return null;
  return `random:${encodeURIComponent(input.sessionId)}:${input.questionIds
    .map(encodeURIComponent)
    .join(',')}`;
}

export function createQuizQuestionSearch(input: QuizProgressScopeInput): string {
  if (input.mode === 'paper') return '';
  if (input.mode === 'single') return '?mode=single';
  if (!input.questionIds.length) return '';

  const sessionSearch = input.sessionId
    ? `&quizSession=${encodeURIComponent(input.sessionId)}`
    : '';
  return `?mode=random&questions=${encodeURIComponent(
    input.questionIds.join(','),
  )}${sessionSearch}`;
}

function isQuestionProgress(value: unknown): value is QuizQuestionProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Partial<QuizQuestionProgress>;
  return (
    (progress.selected === undefined || Number.isInteger(progress.selected)) &&
    (progress.eliminatedOptions === undefined ||
      (Array.isArray(progress.eliminatedOptions) &&
        progress.eliminatedOptions.every(
          (option) => Number.isInteger(option) && option >= 0,
        ))) &&
    Number.isInteger(progress.elapsedSeconds) &&
    typeof progress.startedAt === 'string'
  );
}

function parseQuestionProgress(value: unknown): QuizProgressByQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, QuizQuestionProgress] =>
      isQuestionProgress(entry[1]),
    ),
  );
}

/** Restores scoped in-flight answers, dropping any entry that no longer parses. */
export function parseStoredQuizProgress(raw: string | null): QuizProgressByScope {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const stored = parsed as {
    version?: unknown;
    scopes?: unknown;
  };
  if (
    stored.version !== QUIZ_PROGRESS_STORAGE_VERSION ||
    !stored.scopes ||
    typeof stored.scopes !== 'object' ||
    Array.isArray(stored.scopes)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(stored.scopes).flatMap(([scope, value]) => {
      const progress = parseQuestionProgress(value);
      return Object.keys(progress).length ? [[scope, progress] as const] : [];
    }),
  );
}

export function readQuizProgress(scope: string) {
  return parseStoredQuizProgress(readStoredValue(QUIZ_PROGRESS_STORAGE_KEY))[scope] ?? {};
}

export function writeQuizProgress(scope: string, progress: QuizProgressByQuestion) {
  const progressByScope = parseStoredQuizProgress(
    readStoredValue(QUIZ_PROGRESS_STORAGE_KEY),
  );
  if (Object.keys(progress).length) {
    progressByScope[scope] = progress;
  } else {
    delete progressByScope[scope];
  }
  return writeStoredValue(
    QUIZ_PROGRESS_STORAGE_KEY,
    JSON.stringify({
      version: QUIZ_PROGRESS_STORAGE_VERSION,
      scopes: progressByScope,
    }),
  );
}
