import {
  applyProgressRecord, captureProgress, compareProgress, MAX_PROGRESS_BYTES,
  parseProgressRecord, PROGRESS_JOURNAL_KEY, PROGRESS_OWNER_KEY,
  readLocalProgress, readProgressJournal, type ProgressRecord,
} from './progress-sync';
import { PROGRESS_CHANGED_EVENT, PROGRESS_RESOLVE_EVENT, PROGRESS_SYNC_NOW_EVENT, REMOTE_PROGRESS_URL } from './progress-events';

export interface ProgressConflict { id: string; localUpdatedAt: number; remoteUpdatedAt: number }
export interface ProgressSyncState { status: 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'conflict'; error: string; conflicts?: ProgressConflict[] }
export const PROGRESS_SYNC_INTERVAL_MS = 60_000;
export const PROGRESS_BASELINE_KEY = 'shaneweb:progress-baseline:';
const QUOTA_RETRY_MS = 5 * 60_000;
export interface ProgressTransport {
  listen(receive: (records: Record<string, unknown>) => void, error: (cause?: unknown) => void): () => void;
  /** Atomically writes only if newer, and returns the accepted server version. */
  write(id: string, record: ProgressRecord): Promise<ProgressRecord>;
}

/** Tracks local edits even while signed out. Journals remain bound to their original account. */
export function trackLocalProgress(storage: Storage, writer: string) {
  const capture = (initial = false) => {
    const owner = storage.getItem(PROGRESS_OWNER_KEY) ?? '';
    const journal = readProgressJournal(storage, owner);
    storage.setItem(PROGRESS_JOURNAL_KEY + owner, JSON.stringify(captureProgress(journal, readLocalProgress(storage), writer, initial ? 0 : Date.now())));
  };
  const changed = () => { try { capture(); } catch { /* The app's storage warning owns local failures. */ } };
  const otherTab = (event: StorageEvent) => {
    if (event.url !== REMOTE_PROGRESS_URL && ['shaneweb:practice-session', 'shaneweb:quiz-progress'].includes(event.key ?? '')) changed();
  };
  try { capture(true); } catch { /* Keep local practice usable without storage. */ }
  window.addEventListener(PROGRESS_CHANGED_EVENT, changed);
  window.addEventListener('storage', otherTab);
  return () => {
    window.removeEventListener(PROGRESS_CHANGED_EVENT, changed);
    window.removeEventListener('storage', otherTab);
  };
}

export function connectProgressSync(storage: Storage, uid: string, transport: ProgressTransport, report: (state: ProgressSyncState) => void) {
  let active = true;
  let ready = false;
  let running = false;
  let again = false;
  let failed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let retryAfter = 0;
  const conflicts = new Map<string, ProgressRecord>();
  const acknowledged = new Map<string, ProgressRecord>();
  const baselineKey = PROGRESS_BASELINE_KEY + uid;
  let baseline: Record<string, Pick<ProgressRecord, 'updatedAt' | 'writer'>> = {};
  try {
    const saved = JSON.parse(storage.getItem(baselineKey) ?? '{}');
    baseline = Object.fromEntries(Object.entries(saved).flatMap(([id, value]) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Partial<ProgressRecord>;
      return Number.isSafeInteger(item.updatedAt) && (item.updatedAt ?? -1) >= 0 &&
        typeof item.writer === 'string' && item.writer.length > 0 && item.writer.length <= 80
        ? [[id, { updatedAt: item.updatedAt!, writer: item.writer }]] : [];
    }));
  } catch { /* A missing baseline is handled conservatively as a conflict. */ }
  const error = (cause?: unknown) => {
    if (!active) return;
    failed = true;
    const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
    const quota = code.includes('resource-exhausted');
    if (quota) retryAfter = Date.now() + QUOTA_RETRY_MS;
    report({ status: 'error', error: quota
      ? '雲端用量暫時達上限，進度保留在本機，稍後會再嘗試同步。'
      : '未完成作答暫時無法同步，進度仍保存在本機。請檢查連線與 Firestore 進度規則。' });
  };
  const ownsStorage = () => active && storage.getItem(PROGRESS_OWNER_KEY) === uid;
  const persist = (journal: ReturnType<typeof readProgressJournal>) => storage.setItem(PROGRESS_JOURNAL_KEY + uid, JSON.stringify(journal));
  function assertJournalCurrent() {
    const owner = storage.getItem(PROGRESS_OWNER_KEY) ?? '';
    const journal = readProgressJournal(storage, owner);
    const local = readLocalProgress(storage);
    for (const id of new Set([...Object.keys(journal), ...Object.keys(local)])) {
      if (journal[id]?.payload !== (local[id] ?? null)) throw new Error('Local progress journal could not be saved');
    }
  }

  // Guest work may join the first account. Another account's work never does.
  assertJournalCurrent();
  const owner = storage.getItem(PROGRESS_OWNER_KEY) ?? '';
  if (owner !== uid) {
    const previous = readProgressJournal(storage, owner);
    let next = readProgressJournal(storage, uid);
    if (!owner) next = { ...previous, ...next };
    const keys = [PROGRESS_JOURNAL_KEY + uid, 'shaneweb:practice-session', 'shaneweb:quiz-progress', PROGRESS_OWNER_KEY];
    const original = keys.map(key => [key, storage.getItem(key)] as const);
    const events: StorageEvent[] = [];
    try {
      persist(next);
      for (const id of new Set([...Object.keys(readLocalProgress(storage)), ...Object.keys(next)])) {
        events.push(applyProgressRecord(storage, id, next[id] ?? { version: 1, payload: null, updatedAt: 0, writer: 'account-switch' }, false));
      }
      storage.setItem(PROGRESS_OWNER_KEY, uid);
    } catch (cause) {
      // A quota failure must not relabel the previous account's drafts as the new account's.
      for (const [key, value] of original) {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      }
      throw cause;
    }
    events.forEach(event => window.dispatchEvent(event));
  }

  function remember(id: string, remote: ProgressRecord) {
    const next = { ...baseline, [id]: { updatedAt: remote.updatedAt, writer: remote.writer } };
    storage.setItem(baselineKey, JSON.stringify(next));
    baseline = next;
    acknowledged.set(id, remote);
  }
  function showConflict() {
    const journal = readProgressJournal(storage, uid);
    report({ status: 'conflict', error: '本機與雲端都有不同進度，請選擇要保留哪一份。', conflicts:
      [...conflicts].map(([id, remote]) => ({ id, localUpdatedAt: journal[id]?.updatedAt ?? 0, remoteUpdatedAt: remote.updatedAt })) });
  }
  function adopt(id: string, remote: ProgressRecord) {
    if (!ownsStorage()) return;
    const journal = readProgressJournal(storage, uid);
    const local = journal[id];
    const base = baseline[id];
    const sameVersion = (record: ProgressRecord) => base && record.updatedAt === base.updatedAt && record.writer === base.writer;
    const localChanged = local && !sameVersion(local);
    const remoteChanged = !sameVersion(remote);
    if (local && local.writer !== remote.writer && local.payload !== remote.payload && localChanged && remoteChanged) {
      conflicts.set(id, remote);
      showConflict();
      return;
    }
    conflicts.delete(id);
    if (!journal[id] || compareProgress(remote, journal[id]) > 0) {
      // Do not acknowledge an unapplied draft if storage is full. Publish only once both
      // the draft and its version are saved; React listeners must not echo remote writes.
      const event = applyProgressRecord(storage, id, remote, false);
      persist({ ...journal, [id]: remote });
      window.dispatchEvent(event);
    }
    remember(id, remote);
  }

  async function flush() {
    if (!ownsStorage() || !ready || Date.now() < retryAfter) return;
    if (running) { again = true; return; }
    running = true;
    try {
      assertJournalCurrent();
      const pending = Object.entries(readProgressJournal(storage, uid)).filter(([id, record]) =>
        !conflicts.has(id) && (!acknowledged.has(id) || compareProgress(record, acknowledged.get(id)!) > 0));
      if (pending.length) report({ status: 'syncing', error: '' });
      for (const [id, record] of pending) {
        if (!ownsStorage()) return;
        if (record.payload && new TextEncoder().encode(record.payload).length > MAX_PROGRESS_BYTES) throw new Error('Progress too large');
        const accepted = await transport.write(id, record);
        adopt(id, accepted);
      }
      if (ownsStorage()) {
        failed = false;
        if (conflicts.size) showConflict();
        else if (Object.entries(readProgressJournal(storage, uid)).some(([id, record]) =>
          !acknowledged.has(id) || compareProgress(record, acknowledged.get(id)!) > 0)) schedule();
        else report({ status: 'synced', error: '' });
      }
    } catch (cause) {
      error(cause);
      if (retryAfter > Date.now()) {
        clearTimeout(timeout);
        timeout = setTimeout(() => { timeout = undefined; void flush(); }, retryAfter - Date.now());
      }
    }
    finally {
      running = false;
      if (again && ownsStorage()) { again = false; void flush(); }
    }
  }
  function schedule() {
    if (!ownsStorage()) return;
    if (conflicts.size) showConflict();
    else if (Date.now() >= retryAfter) report({ status: 'pending', error: '' });
    if (!timeout) timeout = setTimeout(() => { timeout = undefined; void flush(); },
      Math.max(PROGRESS_SYNC_INTERVAL_MS, retryAfter - Date.now()));
  }
  const changed = () => schedule();
  const storageChanged = (event: StorageEvent) => {
    if (event.key === PROGRESS_JOURNAL_KEY + uid) schedule();
  };
  const flushNow = () => {
    if (Date.now() < retryAfter) return;
    clearTimeout(timeout); timeout = undefined; void flush();
  };
  const hidden = () => { if (document.visibilityState === 'hidden') flushNow(); };
  const retryOnFocus = () => { if (failed) flushNow(); };
  const resolve = (event: Event) => {
    const { id, choice } = (event as CustomEvent<{ id: string; choice: 'local' | 'remote' }>).detail ?? {};
    const remote = conflicts.get(id);
    if (!remote || !ownsStorage()) return;
    try {
      const journal = readProgressJournal(storage, uid);
      const local = journal[id];
      if (!local || (choice !== 'local' && choice !== 'remote')) return;
      remember(id, remote);
      if (choice === 'remote') {
        const changedEvent = applyProgressRecord(storage, id, remote, false);
        persist({ ...journal, [id]: remote });
        window.dispatchEvent(changedEvent);
      } else {
        persist({ ...journal, [id]: { ...local, updatedAt: Math.max(Date.now(), remote.updatedAt + 1, local.updatedAt + 1) } });
      }
      conflicts.delete(id);
      if (conflicts.size) showConflict();
      else if (choice === 'local') { report({ status: 'pending', error: '' }); flushNow(); }
      else void flush();
    } catch (cause) { error(cause); }
  };
  report({ status: 'syncing', error: '' });
  const unsubscribe = transport.listen((records) => {
    if (!ownsStorage()) return;
    try {
      assertJournalCurrent();
      for (const [id, value] of Object.entries(records)) {
        const record = parseProgressRecord(id, value);
        if (!record) throw new Error('Invalid progress');
        adopt(id, record);
      }
      if (!ready) {
        ready = true;
        void flush();
      }
    } catch (cause) { error(cause); }
  }, error);
  window.addEventListener(PROGRESS_CHANGED_EVENT, changed);
  window.addEventListener('storage', storageChanged);
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('focus', retryOnFocus);
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener(PROGRESS_SYNC_NOW_EVENT, flushNow);
  window.addEventListener(PROGRESS_RESOLVE_EVENT, resolve);
  return () => {
    active = false;
    clearTimeout(timeout);
    unsubscribe();
    window.removeEventListener(PROGRESS_CHANGED_EVENT, changed);
    window.removeEventListener('storage', storageChanged);
    window.removeEventListener('pagehide', flushNow);
    window.removeEventListener('focus', retryOnFocus);
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener(PROGRESS_SYNC_NOW_EVENT, flushNow);
    window.removeEventListener(PROGRESS_RESOLVE_EVENT, resolve);
  };
}
