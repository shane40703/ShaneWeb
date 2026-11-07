import { hasPracticeProgress, parsePracticeSession, PRACTICE_SESSION_STORAGE_KEY } from '@/features/practice/practice-session';
import { parseStoredQuizProgress, QUIZ_PROGRESS_STORAGE_KEY } from '@/features/practice/mock-exam-progress';
import { REMOTE_PROGRESS_URL } from './progress-events';

export const PROGRESS_OWNER_KEY = 'shaneweb:progress-owner';
export const PROGRESS_JOURNAL_KEY = 'shaneweb:progress-journal:';
export const MAX_PROGRESS_BYTES = 700000;
export interface ProgressRecord {
  version: 1;
  payload: string | null;
  updatedAt: number;
  writer: string;
}
export type ProgressJournal = Record<string, ProgressRecord>;

export function validProgressId(id: string) {
  return id === 'practice' || /^paper-(law|env|construction|structure)-\d{3}$/.test(id);
}

/** Canonicalise and validate before either upload or adoption. No question bodies or images. */
export function normalizeProgress(id: string, payload: unknown): string | null | undefined {
  if (!validProgressId(id)) return undefined;
  if (payload === null) return null;
  if (typeof payload !== 'string' || new TextEncoder().encode(payload).length > MAX_PROGRESS_BYTES) return undefined;
  if (id === 'practice') {
    try {
      const value = JSON.parse(payload);
      if (typeof value?.id !== 'string' || !value.id) return undefined;
    } catch { return undefined; }
    const session = parsePracticeSession(payload);
    return session ? JSON.stringify(session) : undefined;
  }
  try {
    const scope = id.replaceAll('-', ':');
    const progress = parseStoredQuizProgress(JSON.stringify({ version: 2, scopes: { [scope]: JSON.parse(payload) } }))[scope];
    return progress ? JSON.stringify(progress) : undefined;
  } catch { return undefined; }
}

export function parseProgressRecord(id: string, value: unknown): ProgressRecord | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as ProgressRecord;
  const payload = normalizeProgress(id, data.payload);
  return data.version === 1 && payload !== undefined && Number.isSafeInteger(data.updatedAt) && data.updatedAt >= 0 &&
    typeof data.writer === 'string' && data.writer.length > 0 && data.writer.length <= 80
    ? { version: 1, payload, updatedAt: data.updatedAt, writer: data.writer } : null;
}

/** Logical time plus a stable writer breaks simultaneous-edit ties on all devices. */
export function compareProgress(a: ProgressRecord, b: ProgressRecord) {
  return a.updatedAt - b.updatedAt || (a.writer < b.writer ? -1 : a.writer > b.writer ? 1 : 0);
}

export function readProgressJournal(storage: Storage, owner: string): ProgressJournal {
  try {
    const values = JSON.parse(storage.getItem(PROGRESS_JOURNAL_KEY + owner) ?? '{}');
    return Object.fromEntries(Object.entries(values).flatMap(([id, value]) => {
      const record = parseProgressRecord(id, value);
      return record ? [[id, record]] : [];
    }));
  } catch { return {}; }
}

export function readLocalProgress(storage: Storage): Record<string, string> {
  const result: Record<string, string> = {};
  const practice = parsePracticeSession(storage.getItem(PRACTICE_SESSION_STORAGE_KEY));
  if (practice && (hasPracticeProgress(practice) || practice.currentIndex > 0)) result.practice = JSON.stringify(practice);
  for (const [scope, progress] of Object.entries(parseStoredQuizProgress(storage.getItem(QUIZ_PROGRESS_STORAGE_KEY)))) {
    const id = scope.replaceAll(':', '-');
    if (validProgressId(id)) result[id] = JSON.stringify(progress);
  }
  return result;
}

/** Missing entries become tombstones, so completed/reset work cannot return from a stale device. */
export function captureProgress(journal: ProgressJournal, local: Record<string, string>, writer: string, now = Date.now()): ProgressJournal {
  const next = { ...journal };
  for (const id of new Set([...Object.keys(journal), ...Object.keys(local)])) {
    const payload = local[id] ?? null;
    if (journal[id]?.payload === payload) continue;
    next[id] = { version: 1, payload, writer, updatedAt: Math.max(now, (journal[id]?.updatedAt ?? -1) + 1) };
  }
  return next;
}

/** Preserve DOM order, draft schemas and native cross-tab subscriptions. No write echo. */
export function applyProgressRecord(storage: Storage, id: string, record: ProgressRecord, notify = true) {
  const key = id === 'practice' ? PRACTICE_SESSION_STORAGE_KEY : QUIZ_PROGRESS_STORAGE_KEY;
  const oldValue = storage.getItem(key);
  let newValue = record.payload;
  if (id !== 'practice') {
    const scopes = parseStoredQuizProgress(oldValue);
    const scope = id.replaceAll('-', ':');
    if (record.payload === null) delete scopes[scope];
    else scopes[scope] = JSON.parse(record.payload);
    newValue = JSON.stringify({ version: 2, scopes });
  }
  if (newValue !== oldValue) {
    if (newValue === null) storage.removeItem(key);
    else storage.setItem(key, newValue);
  }
  const event = new StorageEvent('storage', { key, oldValue, newValue, url: REMOTE_PROGRESS_URL });
  if (notify) window.dispatchEvent(event);
  return event;
}
