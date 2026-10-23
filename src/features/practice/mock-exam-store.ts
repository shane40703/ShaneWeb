import {
  composeQuizProgress,
  parseStoredQuizProgress,
  QUIZ_PROGRESS_STORAGE_KEY,
  type QuizProgressByQuestion,
} from './mock-exam-progress';
import {
  readStoredValue,
  writeStoredValue,
  type StorageWriteResult,
} from '@/lib/storage';

/**
 * Paper drafts live in storage only, so the exam page, the hub card and other tabs
 * all read the same copy. A write the browser refuses is kept here instead, so the
 * paper still works in this tab until a reload.
 */
const listeners = new Set<() => void>();
let unsaved: string | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function adoptOtherTab(event: StorageEvent) {
  if (event.key !== null && event.key !== QUIZ_PROGRESS_STORAGE_KEY) return;
  unsaved = null;
  notify();
}

export function subscribeToMockExamDrafts(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', adoptOtherTab);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', adoptOtherTab);
  };
}

/** The raw stored drafts; a string, so React sees an unchanged value as unchanged. */
export function readMockExamDrafts(): string | null {
  return unsaved ?? readStoredValue(QUIZ_PROGRESS_STORAGE_KEY);
}

export function readMockExamDraft(scope: string): QuizProgressByQuestion {
  return parseStoredQuizProgress(readMockExamDrafts())[scope] ?? {};
}

/** Replaces one paper's draft; an empty one removes it. */
export function saveMockExamDraft(
  scope: string,
  progress: QuizProgressByQuestion,
): StorageWriteResult {
  const next = composeQuizProgress(readMockExamDrafts(), scope, progress);
  const result = writeStoredValue(QUIZ_PROGRESS_STORAGE_KEY, next);
  unsaved = result === 'saved' ? null : next;
  notify();
  return result;
}
