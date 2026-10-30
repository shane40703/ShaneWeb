import { readStoredValue, writeStoredValue } from '@/lib/storage';
import type { QuestionId, SubjectId } from '@/lib/types';

/** Paper drafts, under the key and format the original 考古題討論版 used, so they carry over. */
export const QUIZ_PROGRESS_STORAGE_KEY = 'shaneweb:quiz-progress';
const QUIZ_PROGRESS_STORAGE_VERSION = 2;
const PAPER_SCOPE_PREFIX = 'paper:';

export interface QuizQuestionProgress {
  selected?: number;
  eliminatedOptions?: number[];
  /** 待檢查: a note for this sitting, gone with the draft at 交卷. */
  review?: boolean;
  elapsedSeconds: number;
  startedAt: string;
  /** Last change made on the 歷屆試題模擬考 page, which lists recent papers first. */
  updatedAt?: string;
}

export type QuizProgressByQuestion = Partial<Record<QuestionId, QuizQuestionProgress>>;
export type QuizProgressByScope = Record<string, QuizProgressByQuestion>;

export type QuizProgressAction =
  | { type: 'visit-question'; questionId: QuestionId; startedAt: string }
  | {
      type: 'select-answer';
      questionId: QuestionId;
      selected: number | undefined;
      startedAt: string;
    }
  | {
      type: 'toggle-eliminated-option';
      questionId: QuestionId;
      option: number;
      startedAt: string;
    }
  | { type: 'toggle-review'; questionId: QuestionId; startedAt: string };

export function quizProgressReducer(
  state: QuizProgressByQuestion,
  action: QuizProgressAction,
): QuizProgressByQuestion {
  const current = state[action.questionId] ?? {
    elapsedSeconds: 0,
    startedAt: action.startedAt,
  };

  switch (action.type) {
    case 'visit-question':
      return state[action.questionId]
        ? state
        : { ...state, [action.questionId]: current };
    case 'select-answer': {
      if (current.selected === action.selected) return state;
      const progress = { ...current };
      if (action.selected === undefined) delete progress.selected;
      else progress.selected = action.selected;
      return { ...state, [action.questionId]: progress };
    }
    case 'toggle-eliminated-option': {
      // The chosen answer cannot be struck out.
      if (current.selected === action.option) return state;
      const eliminatedOptions = current.eliminatedOptions ?? [];
      const next = eliminatedOptions.includes(action.option)
        ? eliminatedOptions.filter((option) => option !== action.option)
        : [...eliminatedOptions, action.option].sort((left, right) => left - right);
      const progress = { ...current };
      if (next.length) progress.eliminatedOptions = next;
      else delete progress.eliminatedOptions;
      return { ...state, [action.questionId]: progress };
    }
    case 'toggle-review': {
      const progress = { ...current };
      if (progress.review) delete progress.review;
      else progress.review = true;
      return { ...state, [action.questionId]: progress };
    }
  }
}

/** One paper's draft, shared by every page that opens the paper. */
export function paperProgressScope(subject: SubjectId, year: number) {
  return `${PAPER_SCOPE_PREFIX}${subject}:${year}`;
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
    (progress.review === undefined || typeof progress.review === 'boolean') &&
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

/** Restores the saved drafts, dropping any entry that no longer parses. */
export function parseStoredQuizProgress(raw: string | null): QuizProgressByScope {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const stored = parsed as { version?: unknown; scopes?: unknown };
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

/**
 * The stored value with one paper's draft replaced, or removed when it is empty. Drafts
 * the retired 隨機出題 and single-question pages left behind are dropped on the way.
 */
export function composeQuizProgress(
  raw: string | null,
  scope: string,
  progress: QuizProgressByQuestion,
) {
  const scopes = Object.fromEntries(
    Object.entries(parseStoredQuizProgress(raw)).filter(([key]) =>
      key.startsWith(PAPER_SCOPE_PREFIX),
    ),
  );
  if (Object.keys(progress).length) scopes[scope] = progress;
  else delete scopes[scope];
  return JSON.stringify({ version: QUIZ_PROGRESS_STORAGE_VERSION, scopes });
}

export function writeQuizProgress(scope: string, progress: QuizProgressByQuestion) {
  return writeStoredValue(
    QUIZ_PROGRESS_STORAGE_KEY,
    composeQuizProgress(readStoredValue(QUIZ_PROGRESS_STORAGE_KEY), scope, progress),
  );
}
