import {
  applyProgressRecord, captureProgress, compareProgress, MAX_PROGRESS_BYTES,
  parseProgressRecord, PROGRESS_JOURNAL_KEY, PROGRESS_OWNER_KEY,
  readLocalProgress, readProgressJournal, type ProgressRecord,
} from './progress-sync';
import { PROGRESS_CHANGED_EVENT, REMOTE_PROGRESS_URL } from './progress-events';

export interface ProgressSyncState { status: 'idle' | 'syncing' | 'synced' | 'error'; error: string }
export interface ProgressTransport {
  listen(receive: (records: Record<string, unknown>) => void, error: () => void): () => void;
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
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const acknowledged = new Map<string, ProgressRecord>();
  const error = () => { if (active) report({ status: 'error', error: '未完成作答暫時無法同步，進度仍保存在本機。請檢查連線與 Firestore 進度規則。' }); };
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

  function adopt(id: string, remote: ProgressRecord) {
    if (!ownsStorage()) return;
    const journal = readProgressJournal(storage, uid);
    if (!journal[id] || compareProgress(remote, journal[id]) > 0) {
      // Do not acknowledge an unapplied draft if storage is full. Publish only once both
      // the draft and its version are saved; React listeners must not echo remote writes.
      const event = applyProgressRecord(storage, id, remote, false);
      persist({ ...journal, [id]: remote });
      window.dispatchEvent(event);
    }
    acknowledged.set(id, remote);
  }

  async function flush() {
    if (!ownsStorage() || !ready) return;
    if (running) { again = true; return; }
    running = true;
    try {
      assertJournalCurrent();
      const pending = Object.entries(readProgressJournal(storage, uid)).filter(([id, record]) =>
        !acknowledged.has(id) || compareProgress(record, acknowledged.get(id)!) > 0);
      if (pending.length) report({ status: 'syncing', error: '' });
      for (const [id, record] of pending) {
        if (!ownsStorage()) return;
        if (record.payload && new TextEncoder().encode(record.payload).length > MAX_PROGRESS_BYTES) throw new Error('Progress too large');
        const accepted = await transport.write(id, record);
        adopt(id, accepted);
      }
      if (ownsStorage()) report({ status: 'synced', error: '' });
    } catch { error(); }
    finally {
      running = false;
      if (again && ownsStorage()) { again = false; void flush(); }
    }
  }
  function schedule() {
    if (!ownsStorage()) return;
    report({ status: 'syncing', error: '' });
    clearTimeout(timeout);
    timeout = setTimeout(() => void flush(), 300);
  }
  const changed = () => schedule();
  const storageChanged = (event: StorageEvent) => {
    if (event.key === PROGRESS_JOURNAL_KEY + uid) schedule();
  };
  const flushNow = () => { clearTimeout(timeout); void flush(); };
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
      ready = true;
      void flush();
    } catch { error(); }
  }, error);
  window.addEventListener(PROGRESS_CHANGED_EVENT, changed);
  window.addEventListener('storage', storageChanged);
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', flushNow);
  window.addEventListener('focus', flushNow);
  return () => {
    active = false;
    clearTimeout(timeout);
    unsubscribe();
    window.removeEventListener(PROGRESS_CHANGED_EVENT, changed);
    window.removeEventListener('storage', storageChanged);
    window.removeEventListener('pagehide', flushNow);
    document.removeEventListener('visibilitychange', flushNow);
    window.removeEventListener('focus', flushNow);
  };
}
