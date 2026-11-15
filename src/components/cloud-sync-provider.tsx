import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';
import {
  attemptsGoneFromServer,
  CLOUD_SYNC_CHECKPOINT_PREFIX,
  cloudSyncCheckpointIsValid,
  deleteAndLogAttempts,
  deletionLogRef,
  loadCloudSyncCheckpoint,
  otherAttemptsDue,
  parseDeletionLog,
  saveCloudSyncCheckpoint,
  syncedAtMillis,
} from '@/lib/cloud-sync-checkpoint';
import {
  firebaseConfigurationAvailable,
  getFirebaseServices,
} from '@/lib/firebase-client';
import { firestoreErrorCode } from '@/lib/firestore-error-code';
import { listenRetryDelay } from '@/lib/listen-retry';
import { isQuizAttempt } from '@/lib/study';
import type { QuizAttempt, SyncedNote } from '@/lib/types';
import type { AppAction } from '@/state/app-reducer';
import { useAppState } from '@/state/app-state';
import { ProgressSyncBridge } from './progress-sync-bridge';
import type { ProgressConflict, ProgressSyncState } from '@/lib/progress-sync-client';
import { PROGRESS_RESOLVE_EVENT, PROGRESS_SYNC_NOW_EVENT } from '@/lib/progress-events';

type CloudSyncStatus =
  | 'disabled'
  | 'signed-out'
  | 'syncing'
  | 'pending'
  | 'synced'
  | 'error';

interface CloudSyncContextValue {
  user: User | null;
  status: CloudSyncStatus;
  error: string;
  progressConflicts: ProgressConflict[];
  syncProgressNow: () => void;
  resolveProgressConflict: (id: string, choice: 'local' | 'remote') => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

function firebaseAuthErrorCode(reason: unknown) {
  return reason && typeof reason === 'object' && 'code' in reason &&
    typeof reason.code === 'string'
    ? reason.code
    : '';
}

/** Set while the page is away at Google, so the way back says 登入中 until Firebase answers. */
const SIGN_IN_PENDING_KEY = 'shaneweb:sign-in-pending';

function signInPending() {
  try {
    return sessionStorage.getItem(SIGN_IN_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

function setSignInPending(pending: boolean) {
  try {
    if (pending) sessionStorage.setItem(SIGN_IN_PENDING_KEY, '1');
    else sessionStorage.removeItem(SIGN_IN_PENDING_KEY);
  } catch {
    // Without storage the way back shows 跨裝置同步 until Firebase answers.
  }
}

export function getFirebaseSignInErrorMessage(reason: unknown) {
  switch (firebaseAuthErrorCode(reason)) {
    case 'auth/unauthorized-domain':
      return '目前網域尚未加入 Firebase Authorized domains。';
    case 'auth/operation-not-allowed':
      return 'Firebase 尚未啟用 Google 登入方式。';
    case 'auth/network-request-failed':
      return '無法連線至 Google 登入服務，請檢查網路後重試。';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Firebase API Key 設定無效，請檢查正式環境變數。';
    default:
      return 'Google 登入未完成，請稍後重試。';
  }
}

function cloudAttempt(data: unknown): QuizAttempt | null {
  if (!data || typeof data !== 'object') return null;
  const attempt = { ...(data as Record<string, unknown>) };
  delete attempt.syncedAt;
  return isQuizAttempt(attempt) ? attempt : null;
}

/**
 * What a batch of the attempts listener means for this device. `confirmed` holds the
 * records the server has accepted; only those can be deleted from elsewhere. This device's
 * own pending write echoes back first and is not incoming: local state has it already, and
 * merging it would send it again. A write the server refused comes back as a removal when
 * the SDK rolls it back, so neither changes what was confirmed. A record in `deleted` that the
 * server holds again was sent back by a device that missed its deletion: it is neither
 * merged nor confirmed, only listed in `sentBack` to delete again.
 */
export function readAttemptChanges(
  changes: readonly {
    type: 'added' | 'modified' | 'removed';
    id: string;
    data: unknown;
    pending: boolean;
  }[],
  confirmed: Set<string>,
  deleted: ReadonlySet<string> = new Set(),
) {
  const incoming: QuizAttempt[] = [];
  const removed: string[] = [];
  const sentBack: string[] = [];
  changes.forEach((change) => {
    if (change.type === 'removed') {
      if (confirmed.delete(change.id)) removed.push(change.id);
      return;
    }
    if (change.pending) return;
    if (deleted.has(change.id)) {
      sentBack.push(change.id);
      return;
    }
    const attempt = cloudAttempt(change.data);
    if (!attempt) return;
    confirmed.add(attempt.id);
    incoming.push(attempt);
  });
  return { incoming, removed, sentBack };
}

/** Uploads each record on its own: one the server refuses leaves the others synced. */
export async function uploadEach<T extends { id: string }>(
  items: readonly T[],
  upload: (item: T) => Promise<unknown>,
) {
  const results = await Promise.allSettled(
    items.map((item) => upload(item).then(() => item.id)),
  );
  return {
    synced: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    failed: results.some((result) => result.status === 'rejected'),
  };
}

/**
 * Attempts are immutable by id. Existing server records must not be rewritten at every login,
 * nor records still on their way or refused for good (`skippedIds`).
 */
export function pendingAttemptUploads<T extends { id: string }>(items: readonly T[], confirmedIds: ReadonlySet<string>, ...skippedIds: ReadonlySet<string>[]) {
  return items.filter((item) => !confirmedIds.has(item.id) && !skippedIds.some((ids) => ids.has(item.id)));
}

/**
 * Keys of the records being written now, and of those the server refused. `retired` is set
 * when the account changes, so a write still settling for the last one marks nothing.
 */
interface WriteGuards {
  inFlight: Set<string>;
  rejected: Set<string>;
  retired: boolean;
}

function writeGuards(): WriteGuards {
  return { inFlight: new Set(), rejected: new Set(), retired: false };
}

/**
 * Sends one write while `inFlight` holds its keys, so a re-render meanwhile does not send it
 * again. The SDK retries what it can by itself (offline, quota) and only rejects a write that
 * resending cannot fix, so a refusal moves the keys to `rejected` for the session. A
 * transaction gives up offline too: `refused` tells those failures apart. On success
 * `confirm` runs first, so the record never looks unsent in between. A synchronous SDK throw
 * (bad data) settles like a refused write.
 */
function guardedWrite(
  keys: string | readonly string[],
  guards: WriteGuards,
  write: () => Promise<unknown>,
  confirm: () => void = () => {},
  refused: (reason: unknown) => boolean = () => true,
) {
  const held = typeof keys === 'string' ? [keys] : keys;
  held.forEach((key) => guards.inFlight.add(key));
  return new Promise<unknown>((resolve) => resolve(write())).then(
    () => {
      if (!guards.retired) confirm();
      held.forEach((key) => guards.inFlight.delete(key));
    },
    (reason: unknown) => {
      const forGood = refused(reason);
      held.forEach((key) => {
        guards.inFlight.delete(key);
        if (forGood) guards.rejected.add(key);
      });
      throw reason;
    },
  );
}

/**
 * Transaction failures that running it again later may not meet: offline, over quota, or
 * another write racing it. The SDK has already tried a few times in a row by then.
 */
const TRANSIENT_TRANSACTION_ERRORS = new Set([
  'unavailable',
  'deadline-exceeded',
  'resource-exhausted',
  'aborted',
  'failed-precondition',
  'cancelled',
  'unknown',
  'internal',
  'unauthenticated',
]);

/**
 * Deletes these attempts and adds them to the deletion log in one transaction, guarded by
 * their ids. Offline the transaction fails instead of waiting, and the ids are not marked
 * refused, so a later run sends them again. Refused by rules that do not cover the log yet,
 * each is deleted on its own as before, unlogged: another device that still holds it may
 * then send it back.
 */
function guardedDeletion(
  db: Firestore,
  uid: string,
  attemptIds: readonly string[],
  guards: WriteGuards,
  confirm: (attemptIds: readonly string[]) => void,
) {
  return guardedWrite(
    attemptIds,
    guards,
    () => deleteAndLogAttempts(db, uid, attemptIds),
    () => confirm(attemptIds),
    (reason) => {
      const code = firestoreErrorCode(reason);
      return code !== 'permission-denied' && !TRANSIENT_TRANSACTION_ERRORS.has(code);
    },
  ).catch((reason: unknown) => {
    if (firestoreErrorCode(reason) !== 'permission-denied') throw reason;
    return Promise.all(
      attemptIds.map((attemptId) =>
        guardedWrite(
          attemptId,
          guards,
          () => deleteDoc(doc(db, 'users', uid, 'attempts', attemptId)),
          () => confirm([attemptId]),
        ),
      ),
    );
  });
}

/** Deletions in one transaction, well within the 500 writes it may hold. */
const DELETIONS_PER_TRANSACTION = 100;

// Each new subscription to the deletion log, and each new try of a deletion, reads the log
// again: wait 1 min (5 min over quota), doubling up to 30 min.
const RETRY_LATER = { base: 60_000, quota: 5 * 60_000, max: 30 * 60_000 };

/** Attempts the server has confirmed deleted, as this browser's checkpoint lists them now. */
function deletedOnServer(uid: string) {
  return new Set(loadCloudSyncCheckpoint(uid)?.deletedAttemptIds);
}

/**
 * Removes from this device the records of `deleted` it still holds: a tab that never heard of
 * a deletion may have saved the record back into this browser.
 */
function dropDeletedOnServer(deleted: ReadonlySet<string>, held: readonly QuizAttempt[], dispatch: Dispatch<AppAction>) {
  held.forEach((attempt) => {
    if (deleted.has(attempt.id)) dispatch({ type: 'remove-synced-attempt', attemptId: attempt.id });
  });
}

/** One version of one note; each edit makes a new one. */
function noteVersion(questionId: string, updatedAt: string) {
  return `${questionId} ${updatedAt}`;
}

export function parseCloudNote(data: DocumentData): SyncedNote | null {
  return typeof data.questionId === 'string' &&
    typeof data.content === 'string' &&
    typeof data.updatedAt === 'string'
    ? {
        questionId: data.questionId,
        content: data.content,
        updatedAt: data.updatedAt,
      }
    : null;
}

/** Records synced at or after `after` (ms). syncedAt only grows, so one that leaves was deleted. */
function syncedSince(target: CollectionReference, after: number) {
  return query(target, where('syncedAt', '>=', Timestamp.fromMillis(after)));
}

/** `in` takes at most 30 values. */
const IDS_PER_QUERY = 30;

/**
 * These records again, by document id: a read for each one found, or one for a query that
 * finds none.
 */
function readByIds(target: CollectionReference, ids: readonly string[]) {
  const reads: Promise<QuerySnapshot>[] = [];
  for (let start = 0; start < ids.length; start += IDS_PER_QUERY) {
    reads.push(getDocs(query(target, where(documentId(), 'in', ids.slice(start, start + IDS_PER_QUERY)))));
  }
  return Promise.all(reads);
}

/** A read with each record decoded once: data() converts the whole document at every call. */
interface DecodedRead<T> {
  fromServer: boolean;
  records: { id: string; pending: boolean; syncedAt: number | null; value: T | null }[];
}

function decodeRead<T>(snapshot: QuerySnapshot, parse: (data: DocumentData) => T | null): DecodedRead<T> {
  return {
    fromServer: snapshot.metadata?.fromCache === false,
    records: snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        pending: Boolean(item.metadata?.hasPendingWrites),
        syncedAt: syncedAtMillis(data.syncedAt),
        value: parse(data),
      };
    }),
  };
}

function readValues<T>(read: DecodedRead<T>) {
  return read.records.flatMap((record) => (record.value ? [record.value] : []));
}

/** The latest server syncedAt in a read; a record still on its way has none yet. */
function latestSyncedAt(read: DecodedRead<unknown>) {
  return read.records.reduce(
    (latest, record) => record.pending ? latest : Math.max(latest, record.syncedAt ?? 0),
    0,
  );
}

/**
 * What a read the server answered confirms, for the checkpoint; nothing from the cache.
 * Records this app cannot read are listed apart: the server's count includes them too.
 * Copies of `deleted` records, sent back by a device that missed the deletion, confirm
 * nothing.
 */
function serverAttempts(read: DecodedRead<QuizAttempt>, deleted: ReadonlySet<string>) {
  if (!read.fromServer) return null;
  const attemptIds: string[] = [];
  const otherAttemptIds: string[] = [];
  read.records.forEach((record) => {
    if (record.pending || deleted.has(record.id)) return;
    if (record.value) attemptIds.push(record.value.id);
    else otherAttemptIds.push(record.id);
  });
  return { attemptIds, otherAttemptIds, attemptsAfter: latestSyncedAt(read) };
}

function serverNotes(read: DecodedRead<SyncedNote>) {
  if (!read.fromServer) return null;
  return {
    noteVersions: Object.fromEntries(read.records.flatMap((record) =>
      !record.pending && record.value ? [[record.value.questionId, record.value.updatedAt] as const] : [],
    )),
    notesAfter: latestSyncedAt(read),
  };
}

/** Notes the server holds in an older version than this device: another device's late write. */
function olderOnServer(versions: Readonly<Record<string, string>>, noteUpdatedAt: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    Object.entries(versions).filter(([questionId, updatedAt]) => (noteUpdatedAt[questionId] ?? '') > updatedAt),
  );
}

export function parseCloudDifficultSettings(
  data: DocumentData,
): string[] | null {
  if (!Array.isArray(data.questionIds)) return null;
  return [
    ...new Set(
      data.questionIds.filter(
        (questionId: unknown): questionId is string =>
          typeof questionId === 'string',
      ),
    ),
  ].sort();
}

/** Apply individual local changes to the latest server list inside a transaction. */
export function applyDifficultChanges(questionIds: readonly string[], changes: Record<string, boolean>) {
  const merged = new Set(questionIds);
  for (const [id, marked] of Object.entries(changes)) {
    if (marked) merged.add(id);
    else merged.delete(id);
  }
  return [...merged].sort();
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, hydrated } = useAppState();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<CloudSyncStatus>(() =>
    firebaseConfigurationAvailable() ? 'signed-out' : 'disabled',
  );
  const [error, setError] = useState('');
  const [progressSync, setProgressSync] = useState<ProgressSyncState>({ status: 'idle', error: '' });
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [cloudRetryEpoch, setCloudRetryEpoch] = useState(0);
  const authenticatedUserId = useRef<string | null>(null);
  const syncedAttemptIds = useRef(new Set<string>());
  const syncedNoteVersions = useRef(new Map<string, string>());
  // Replaced at each sign-in, so a write still settling for the last account changes nothing.
  const attemptWrites = useRef(writeGuards());
  const noteWrites = useRef(writeGuards());
  const deletionWrites = useRef(writeGuards());
  // Bumped when the connection returns, or on a timer, to send again deletions whose
  // transaction failed; the timer waits longer after each failure in a row.
  const [deletionRetryEpoch, setDeletionRetryEpoch] = useState(0);
  const deletionFailures = useRef(0);
  const deletionRetryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Bumped when the server holds an older note than this device, to offer ours again.
  const [noteResendEpoch, setNoteResendEpoch] = useState(0);
  const difficultSyncInFlight = useRef(new Set<string>());
  const retryDifficultAfterFlight = useRef(new Set<string>());
  const [difficultSyncEpoch, setDifficultSyncEpoch] = useState(0);
  const latestDifficultChanges = useRef(state.difficultPendingChanges);
  const localAttempts = useRef(state.attempts);
  const localDeletedAttemptIds = useRef(state.deletedAttemptIds);
  const localNotes = useRef({
    notes: state.notes,
    noteUpdatedAt: state.noteUpdatedAt,
  });

  useEffect(() => {
    latestDifficultChanges.current = state.difficultPendingChanges;
  }, [state.difficultPendingChanges]);

  useEffect(() => {
    localAttempts.current = state.attempts;
    localDeletedAttemptIds.current = state.deletedAttemptIds;
  }, [state.attempts, state.deletedAttemptIds]);

  useEffect(() => {
    localNotes.current = {
      notes: state.notes,
      noteUpdatedAt: state.noteUpdatedAt,
    };
  }, [state.noteUpdatedAt, state.notes]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    let active = true;
    // Back from Google: Firebase reads the result before it reports the user.
    if (signInPending()) void Promise.resolve().then(() => active && setStatus('syncing'));
    const stopListening = onAuthStateChanged(firebase.auth, (nextUser) => {
      setSignInPending(false);
      authenticatedUserId.current = nextUser?.uid ?? null;
      setUser(nextUser);
      setReadyUserId(null);
      syncedAttemptIds.current.clear();
      syncedNoteVersions.current.clear();
      [attemptWrites, noteWrites, deletionWrites].forEach((writes) => {
        writes.current.retired = true;
        writes.current = writeGuards();
      });
      setError('');
      setStatus(nextUser ? 'syncing' : 'signed-out');
    });
    // Why a trip to Google came back without a user; the listener above has already run.
    getRedirectResult(firebase.auth).catch((reason) => {
      if (active && !authenticatedUserId.current) setError(getFirebaseSignInErrorMessage(reason));
    });
    return () => {
      active = false;
      stopListening();
    };
  }, []);

  useEffect(() => {
    // Leaving Google with Back or ✕ can bring this page back exactly as it was left, on 登入中.
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted || authenticatedUserId.current) return;
      setSignInPending(false);
      setStatus((current) => (current === 'syncing' ? 'signed-out' : current));
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || !hydrated) return;

    let active = true;
    let stopListening: (() => void) | undefined;
    let stopListeningToNotes: (() => void) | undefined;
    let stopListeningToDifficult: (() => void) | undefined;
    let stopListeningToLog: (() => void) | undefined;
    let logRetry: ReturnType<typeof setTimeout> | undefined;
    const attempts = collection(firebase.db, 'users', user.uid, 'attempts');
    const notes = collection(firebase.db, 'users', user.uid, 'notes');
    const difficult = doc(firebase.db, 'users', user.uid, 'settings', 'difficult');
    const deletionLog = deletionLogRef(firebase.db, user.uid);

    void (async () => {
      try {
        // The deletion log first, so nothing deleted on any device is merged or sent again.
        // Without the server's answer (offline, or rules that do not cover the log yet) this
        // load goes by what the checkpoint already knows.
        const logged = new Set<string>();
        try {
          const logSnapshot = await getDoc(deletionLog);
          if (logSnapshot.metadata?.fromCache === false && logSnapshot.exists()) {
            parseDeletionLog(logSnapshot.data()).forEach((attemptId) => logged.add(attemptId));
          }
        } catch {
          // The listener below reads it once it can.
        }
        if (!active) return;
        // What this browser already holds is not read again, but only while its data still
        // covers the checkpoint; otherwise both collections are read in full.
        const stored = loadCloudSyncCheckpoint(user.uid);
        // Deleted on the server, as the log or this browser knows. A tab that never heard of
        // it may have saved it back. The listeners below add to it.
        const deleted = new Set([...logged, ...(stored?.deletedAttemptIds ?? [])]);
        if (logged.size) saveCloudSyncCheckpoint(user.uid, { deletedAttemptIds: [...logged] });
        dropDeletedOnServer(deleted, localAttempts.current, dispatch);
        // Deleted since this browser confirmed them: neither on the server nor counted there.
        const known = stored && {
          ...stored,
          attemptIds: stored.attemptIds.filter((attemptId) => !deleted.has(attemptId)),
          otherAttemptIds: stored.otherAttemptIds.filter((attemptId) => !deleted.has(attemptId)),
        };
        const checkpoint = known && cloudSyncCheckpointIsValid(known, {
          attempts: localAttempts.current,
          deletedAttemptIds: localDeletedAttemptIds.current,
          noteUpdatedAt: localNotes.current.noteUpdatedAt,
        }) ? known : null;
        checkpoint?.attemptIds.forEach((attemptId) => syncedAttemptIds.current.add(attemptId));
        Object.entries(checkpoint?.noteVersions ?? {}).forEach(([questionId, updatedAt]) =>
          syncedNoteVersions.current.set(questionId, updatedAt),
        );

        // Sent back after their deletion by a device that missed it: deleted again. One the
        // log lists needs nothing more; any other is logged now, so the device that sent it
        // back drops it at its next load instead of sending it once more.
        const deleteAgain = (attemptIds: Iterable<string>) => {
          const guards = deletionWrites.current;
          const again = [...attemptIds].filter(
            (attemptId) => !guards.inFlight.has(attemptId) && !guards.rejected.has(attemptId),
          );
          again.filter((attemptId) => logged.has(attemptId)).forEach((attemptId) => {
            void guardedWrite(attemptId, guards, () => deleteDoc(doc(attempts, attemptId))).catch(() => {
              // Refused: a later load finds it again.
            });
          });
          const unlogged = again.filter((attemptId) => !logged.has(attemptId));
          // One transaction after another: each changes the log. A later batch of the
          // listener may have sent some meanwhile.
          void (async () => {
            for (let start = 0; start < unlogged.length && active; start += DELETIONS_PER_TRANSACTION) {
              const chunk = unlogged.slice(start, start + DELETIONS_PER_TRANSACTION).filter(
                (attemptId) => !guards.inFlight.has(attemptId) && !guards.rejected.has(attemptId),
              );
              if (!chunk.length) continue;
              await guardedDeletion(firebase.db, user.uid, chunk, guards, (attemptIds) =>
                saveCloudSyncCheckpoint(user.uid, { deletedAttemptIds: attemptIds }),
              ).catch(() => {
                // Offline or refused: a later load finds them again.
              });
            }
          })();
        };
        const sentBack = new Set<string>();
        // Decodes a read of the attempts once and merges what it holds into this device, but
        // for copies of deleted records, which are only kept aside to delete again.
        const mergeRead = (attemptSnapshot: QuerySnapshot) => {
          const read = decodeRead(attemptSnapshot, cloudAttempt);
          if (read.fromServer) {
            read.records.forEach((record) => {
              if (!record.pending && deleted.has(record.id)) sentBack.add(record.id);
            });
          }
          const remoteAttempts = readValues(read).filter((attempt) => !deleted.has(attempt.id));
          remoteAttempts.forEach((attempt) =>
            syncedAttemptIds.current.add(attempt.id),
          );
          dispatch({ type: 'merge-attempts', attempts: remoteAttempts });
          return read;
        };
        const snapshot = await getDocs(checkpoint ? syncedSince(attempts, checkpoint.attemptsAfter) : attempts);
        if (!active) return;
        const read = mergeRead(snapshot);
        let attemptsSeen = serverAttempts(read, deleted);
        // Missing from the server without having been deleted: they only leave the checkpoint.
        const unlisted = new Set<string>();
        // The whole collection: read at once without a checkpoint, or when the count differs.
        let full = checkpoint ? null : read;
        if (checkpoint) {
          // A since-read cannot see records deleted on another device; one count can.
          let count: number | null = null;
          try {
            count = (await getCountFromServer(attempts)).data().count;
          } catch {
            // Without it this load removes nothing; the next one counts again.
          }
          if (!active) return;
          const readIds = new Set(read.records.map((record) => record.id));
          // Deleted records the checkpoint listed are not expected; a copy sent back that
          // this read found is on the server, and counted there.
          const expected = new Set([...checkpoint.attemptIds, ...checkpoint.otherAttemptIds, ...readIds]).size;
          if (count !== null && count !== expected) {
            const fullSnapshot = await getDocs(attempts);
            if (!active) return;
            full = mergeRead(fullSnapshot);
          } else if (count !== null && otherAttemptsDue(checkpoint, Date.now())) {
            // The since-read skips the records this app could not read: those alone are read
            // again, as this version may read them, or a page older than them listed them.
            const ids = checkpoint.otherAttemptIds.filter((attemptId) => !readIds.has(attemptId));
            try {
              const snapshots = await readByIds(attempts, ids);
              if (!active) return;
              const reads = snapshots.map(mergeRead);
              const seen = reads.map((item) => serverAttempts(item, deleted));
              if (seen.every((item) => item !== null)) {
                const found = new Set(reads.flatMap((item) => item.records.map((record) => record.id)));
                saveCloudSyncCheckpoint(user.uid, {
                  attemptIds: seen.flatMap((item) => item.attemptIds),
                  // Gone since the count: they only leave the list.
                  removedAttemptIds: ids.filter((attemptId) => !found.has(attemptId)),
                  otherCheckedAt: Date.now(),
                });
              }
            } catch {
              // Without them the list is read again at the next load.
            }
          }
        }
        // A read from the cache may lack records the server has, so it removes nothing.
        const fullSeen = full && serverAttempts(full, deleted);
        if (full && fullSeen && stored) {
          const onServer = new Set(full.records.map((record) => record.id));
          // Only records the server once confirmed: one never uploaded stays. A checkpoint
          // this browser's data no longer covers lists such records too. The deleted ones
          // left this device above; the lost ones stay and are sent again.
          const { lost } = attemptsGoneFromServer(stored.attemptIds, onServer, deleted);
          lost.forEach((attemptId) => {
            syncedAttemptIds.current.delete(attemptId);
            unlisted.add(attemptId);
          });
          if (checkpoint) {
            // The read replaces the list of records this app cannot read.
            checkpoint.otherAttemptIds.forEach((attemptId) => {
              if (!onServer.has(attemptId)) unlisted.add(attemptId);
            });
            attemptsSeen = {
              ...fullSeen,
              attemptsAfter: Math.max(fullSeen.attemptsAfter, attemptsSeen?.attemptsAfter ?? 0),
            };
          }
        }
        if (checkpoint && attemptsSeen) {
          saveCloudSyncCheckpoint(user.uid, {
            ...attemptsSeen,
            removedAttemptIds: [...unlisted],
            // A full read has read every record this app cannot read.
            otherCheckedAt: fullSeen ? Date.now() : undefined,
          });
        }
        deleteAgain(sentBack);

        const noteSnapshot = await getDocs(checkpoint ? syncedSince(notes, checkpoint.notesAfter) : notes);
        if (!active) return;
        const noteRead = decodeRead(noteSnapshot, parseCloudNote);
        const remoteNotes = readValues(noteRead);
        remoteNotes.forEach((note) =>
          syncedNoteVersions.current.set(note.questionId, note.updatedAt),
        );
        dispatch({ type: 'merge-notes', notes: remoteNotes });
        const notesSeen = serverNotes(noteRead);
        if (!checkpoint) {
          // Read in full: what the server holds now starts the checkpoint over, keeping the
          // deletions. A part read from the cache starts empty and is read in full next time.
          saveCloudSyncCheckpoint(user.uid, {
            ...attemptsSeen,
            ...notesSeen,
            otherCheckedAt: attemptsSeen ? Date.now() : undefined,
          }, true);
        } else if (notesSeen) {
          saveCloudSyncCheckpoint(user.uid, {
            ...notesSeen,
            replaceNoteVersions: olderOnServer(notesSeen.noteVersions, localNotes.current.noteUpdatedAt),
          });
        }

        const difficultSnapshot = await getDoc(difficult);
        if (!active) return;
        const difficultQuestionIds = difficultSnapshot.exists()
          ? parseCloudDifficultSettings(difficultSnapshot.data())
          : [];
        if (!difficultQuestionIds) throw new Error('Invalid cloud difficult settings');
        dispatch({
          type: 'merge-cloud-difficult',
          questionIds: difficultQuestionIds,
          authoritative: !difficultSnapshot.metadata?.fromCache,
        });

        // One record the server refuses must not keep notes and 難題標記 from syncing;
        // it stays unsynced and is offered again at the next sign-in or page load.
        const guards = attemptWrites.current;
        // The list is read again: another tab may have confirmed a deletion meanwhile.
        const uploads = await uploadEach(pendingAttemptUploads(localAttempts.current, syncedAttemptIds.current, guards.inFlight, guards.rejected, deleted, deletedOnServer(user.uid)), (attempt) =>
          guardedWrite(attempt.id, guards, () => setDoc(
            doc(attempts, attempt.id),
            { ...attempt, syncedAt: serverTimestamp() },
            { merge: true },
          ), () => saveCloudSyncCheckpoint(user.uid, { attemptIds: [attempt.id] })),
        );
        if (!active) return;
        uploads.synced.forEach((attemptId) => syncedAttemptIds.current.add(attemptId));
        const attemptUploadFailed = uploads.failed;

        const remoteNoteIds = new Set([
          ...remoteNotes.map((note) => note.questionId),
          // On the server although not read again.
          ...Object.keys(checkpoint?.noteVersions ?? {}),
        ]);
        const legacyLocalNotes = Object.keys(localNotes.current.notes)
          .filter(
            (questionId) =>
              !localNotes.current.noteUpdatedAt[questionId] &&
              !remoteNoteIds.has(questionId),
          )
          .map((questionId) => ({
            questionId,
            content: localNotes.current.notes[questionId],
            updatedAt: new Date().toISOString(),
          }));
        if (legacyLocalNotes.length) {
          dispatch({ type: 'merge-notes', notes: legacyLocalNotes });
          await Promise.all(
            legacyLocalNotes.map((note) =>
              setDoc(
                doc(notes, note.questionId),
                { ...note, syncedAt: serverTimestamp() },
                { merge: true },
              ),
            ),
          );
          legacyLocalNotes.forEach((note) =>
            syncedNoteVersions.current.set(note.questionId, note.updatedAt),
          );
          saveCloudSyncCheckpoint(user.uid, {
            noteVersions: Object.fromEntries(legacyLocalNotes.map((note) => [note.questionId, note.updatedAt])),
          });
        }
        setReadyUserId(user.uid);
        if (attemptUploadFailed) {
          setError('部分作答紀錄暫時無法同步到雲端，已保存在本機。');
          setStatus('error');
        } else {
          setStatus('synced');
        }

        // Only what was synced since this page read: a reconnect after a long sleep reads that
        // much again, not both whole collections, and the same query as the read resumes it.
        const attemptsAfter = Math.max(checkpoint?.attemptsAfter ?? 0, attemptsSeen?.attemptsAfter ?? 0);
        const notesAfter = Math.max(checkpoint?.notesAfter ?? 0, notesSeen?.notesAfter ?? 0);

        stopListening = onSnapshot(
          syncedSince(attempts, attemptsAfter),
          (nextSnapshot) => {
            // Another tab may have confirmed a deletion since.
            const deletedNow = new Set([...deleted, ...deletedOnServer(user.uid)]);
            const { incoming, removed, sentBack: sentBackNow } = readAttemptChanges(
              nextSnapshot.docChanges().map((change) => ({
                type: change.type,
                id: change.doc.id,
                data: change.doc.data(),
                pending: change.doc.metadata.hasPendingWrites,
              })),
              syncedAttemptIds.current,
              deletedNow,
            );
            removed.forEach((attemptId) =>
              dispatch({ type: 'remove-synced-attempt', attemptId }),
            );
            if (incoming.length) dispatch({ type: 'merge-attempts', attempts: incoming });
            deleteAgain(sentBackNow);
            const seen = serverAttempts(decodeRead(nextSnapshot, cloudAttempt), deletedNow);
            if (seen) {
              saveCloudSyncCheckpoint(user.uid, {
                ...seen,
                // This device's own deletion is listed once the server confirms it.
                deletedAttemptIds: removed.filter((attemptId) => !deletionWrites.current.inFlight.has(attemptId)),
              });
            }
            setStatus('synced');
          },
          () => {
            setError('無法讀取雲端作答紀錄，請確認 Firestore 權限設定。');
            setStatus('error');
          },
        );

        stopListeningToNotes = onSnapshot(
          syncedSince(notes, notesAfter),
          (nextSnapshot) => {
            const incoming = nextSnapshot.docChanges().flatMap((change) => {
              // A pending change is this device's own write echoing back: local state has
              // it, and only the server's answer may count that version as synced.
              if (change.type === 'removed' || change.doc.metadata.hasPendingWrites) return [];
              const note = parseCloudNote(change.doc.data());
              if (note) {
                syncedNoteVersions.current.set(
                  note.questionId,
                  note.updatedAt,
                );
              }
              return note ? [note] : [];
            });
            if (incoming.length) dispatch({ type: 'merge-notes', notes: incoming });
            // Another device's late write took the server back to an older version: send
            // ours again. The upload effect skips a version on its way or refused.
            if (
              incoming.some(
                (note) => (localNotes.current.noteUpdatedAt[note.questionId] ?? '') > note.updatedAt,
              )
            ) {
              setNoteResendEpoch((value) => value + 1);
            }
            const seen = serverNotes(decodeRead(nextSnapshot, parseCloudNote));
            if (seen) {
              saveCloudSyncCheckpoint(user.uid, {
                ...seen,
                replaceNoteVersions: olderOnServer(seen.noteVersions, localNotes.current.noteUpdatedAt),
              });
            }
            setStatus('synced');
          },
          () => {
            setError('無法讀取雲端筆記，請確認 Firestore 權限設定。');
            setStatus('error');
          },
        );

        stopListeningToDifficult = onSnapshot(
          difficult,
          (snapshot) => {
            if (!snapshot.exists()) return;
            const questionIds = parseCloudDifficultSettings(snapshot.data());
            if (!questionIds) {
              setError('雲端難題標記資料異常，本機標記仍保留。');
              setStatus('error');
              return;
            }
            dispatch({
              type: 'merge-cloud-difficult',
              questionIds,
              authoritative: !snapshot.metadata.fromCache,
            });
            setStatus('synced');
          },
          () => {
            setError('無法讀取雲端難題標記，請確認 Firestore 權限設定。');
            setStatus('error');
          },
        );

        // Deletions made on another device, older attempts included, which the attempts
        // listener does not watch: each id new to this page leaves it and joins the
        // checkpoint. One read to start, and one for each change to the log.
        let logFailures = 0;
        const listenToLog = () => {
          stopListeningToLog = onSnapshot(
            deletionLog,
            // The server's answer may only change the metadata of what the cache held.
            { includeMetadataChanges: true },
            (snapshot) => {
              if (snapshot.metadata.fromCache) return;
              logFailures = 0;
              const fresh = (snapshot.exists() ? parseDeletionLog(snapshot.data()) : []).filter(
                (attemptId) => !logged.has(attemptId),
              );
              if (!fresh.length) return;
              // This page may have confirmed a copy, or sent one back as lost, just before it
              // heard of the deletion: that copy leaves the server again. Listed already, so a
              // plain delete is enough.
              const heldOnServer = fresh.filter((attemptId) => syncedAttemptIds.current.has(attemptId));
              fresh.forEach((attemptId) => {
                logged.add(attemptId);
                deleted.add(attemptId);
                syncedAttemptIds.current.delete(attemptId);
              });
              saveCloudSyncCheckpoint(user.uid, { deletedAttemptIds: fresh });
              dropDeletedOnServer(new Set(fresh), localAttempts.current, dispatch);
              deleteAgain(heldOnServer);
            },
            (cause) => {
              // Rules that do not cover the log yet, or another problem no timer fixes, wait
              // for the next load; until then this page hears of deletions made elsewhere only
              // when it loads again.
              // Other failures subscribe again, less often each time.
              const wait = listenRetryDelay(cause, logFailures, RETRY_LATER);
              if (wait === null) return;
              logFailures += 1;
              logRetry = setTimeout(() => {
                if (active) listenToLog();
              }, wait);
            },
          );
        };
        listenToLog();
      } catch {
        if (!active) return;
        setError('作答紀錄同步失敗，請檢查網路或 Firebase 設定。');
        setStatus('error');
      }
    })();

    return () => {
      active = false;
      clearTimeout(logRetry);
      stopListening?.();
      stopListeningToNotes?.();
      stopListeningToDifficult?.();
      stopListeningToLog?.();
    };
  }, [dispatch, hydrated, user, cloudRetryEpoch]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || readyUserId !== user.uid) return;
    const guards = deletionWrites.current;
    // Each confirmed deletion changes the list: the others still on their way, or refused,
    // are not sent again. Oldest first, as the log keeps them; past one transaction's worth,
    // the rest go once these are confirmed.
    const deletions = state.deletedAttemptIds.filter(
      (attemptId) => !guards.inFlight.has(attemptId) && !guards.rejected.has(attemptId),
    ).reverse().slice(0, DELETIONS_PER_TRANSACTION);
    if (!deletions.length) return;

    setStatus('syncing');
    // All of them in one transaction, which logs them for the other devices. One that fails
    // offline leaves them pending for the next run: going online, another deletion, or the
    // next sign-in or page load.
    void guardedDeletion(firebase.db, user.uid, deletions, guards, (attemptIds) => {
      attemptIds.forEach((attemptId) => syncedAttemptIds.current.delete(attemptId));
      saveCloudSyncCheckpoint(user.uid, { deletedAttemptIds: attemptIds });
      attemptIds.forEach((attemptId) => dispatch({ type: 'confirm-attempt-deletion', attemptId }));
    })
      .then(() => {
        deletionFailures.current = 0;
        setStatus('synced');
      })
      .catch((reason: unknown) => {
        const code = firestoreErrorCode(reason);
        const later = TRANSIENT_TRANSACTION_ERRORS.has(code);
        setError(later
          ? '紀錄已從本機移除，恢復連線後會自動刪除雲端紀錄。'
          : '紀錄已從本機移除，恢復連線後請重新登入以刪除雲端紀錄。');
        setStatus('error');
        if (!later) return;
        // A transaction gives up within seconds, where a plain delete waited in the SDK's
        // queue: so a timer tries again as well, for a connection that fails without the
        // browser saying it went offline, or a quota that comes back.
        const base = code === 'resource-exhausted' ? RETRY_LATER.quota : RETRY_LATER.base;
        clearTimeout(deletionRetryTimer.current);
        deletionRetryTimer.current = setTimeout(
          () => setDeletionRetryEpoch((value) => value + 1),
          Math.min(RETRY_LATER.max, base * 2 ** deletionFailures.current++),
        );
      });
  }, [deletionRetryEpoch, dispatch, readyUserId, state.deletedAttemptIds, user]);

  useEffect(() => {
    // Another account starts with no failures, and a retry left for the last one stops.
    const timer = deletionRetryTimer;
    deletionFailures.current = 0;
    return () => clearTimeout(timer.current);
  }, [user]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || readyUserId !== user.uid) return;
    const guards = attemptWrites.current;
    // Not again while its write is on its way, nor after the server refused it.
    const unsynced = state.attempts.filter(
      (attempt) =>
        !state.deletedAttemptIds.includes(attempt.id) &&
        !syncedAttemptIds.current.has(attempt.id) &&
        !guards.inFlight.has(attempt.id) &&
        !guards.rejected.has(attempt.id),
    );
    if (!unsynced.length) return;
    // Nor one whose deletion another tab has confirmed; its storage event drops it here.
    const deleted = deletedOnServer(user.uid);
    const uploads = unsynced.filter((attempt) => !deleted.has(attempt.id));
    if (!uploads.length) return;

    setStatus('syncing');
    void Promise.all(
      uploads.map((attempt) =>
        guardedWrite(
          attempt.id,
          guards,
          () => setDoc(
            doc(firebase.db, 'users', user.uid, 'attempts', attempt.id),
            { ...attempt, syncedAt: serverTimestamp() },
            { merge: true },
          ),
          () => {
            syncedAttemptIds.current.add(attempt.id);
            saveCloudSyncCheckpoint(user.uid, { attemptIds: [attempt.id] });
          },
        ),
      ),
    )
      .then(() => setStatus('synced'))
      .catch(() => {
        setError('最新作答仍保存在本機，恢復連線後請重新登入同步。');
        setStatus('error');
      });
  }, [readyUserId, state.attempts, state.deletedAttemptIds, user]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || readyUserId !== user.uid) return;
    const guards = noteWrites.current;
    // A version on its way, or refused, is not sent again; a later edit is a new version
    // and is.
    const changedNotes = Object.keys(state.noteUpdatedAt).filter((questionId) => {
      const updatedAt = state.noteUpdatedAt[questionId];
      const version = noteVersion(questionId, updatedAt);
      return (
        syncedNoteVersions.current.get(questionId) !== updatedAt &&
        !guards.inFlight.has(version) &&
        !guards.rejected.has(version)
      );
    });
    if (!changedNotes.length) return;

    setStatus('syncing');
    void Promise.all(
      changedNotes.map((questionId) => {
        const updatedAt = state.noteUpdatedAt[questionId];
        return guardedWrite(
          noteVersion(questionId, updatedAt),
          guards,
          () => setDoc(
            doc(firebase.db, 'users', user.uid, 'notes', questionId),
            {
              questionId,
              content: state.notes[questionId] ?? '',
              updatedAt,
              syncedAt: serverTimestamp(),
            },
            { merge: true },
          ),
          () => {
            syncedNoteVersions.current.set(questionId, updatedAt);
            saveCloudSyncCheckpoint(user.uid, { noteVersions: { [questionId]: updatedAt } });
          },
        );
      }),
    )
      .then(() => setStatus('synced'))
      .catch(() => {
        setError('最新筆記仍保存在本機，恢復連線後請重新登入同步。');
        setStatus('error');
      });
  }, [noteResendEpoch, readyUserId, state.noteUpdatedAt, state.notes, user]);

  useEffect(() => {
    if (!user) return;
    // Another tab confirmed a deletion that this tab's listener, reading only what is new,
    // cannot see: drop the record here too, or this tab would save it back.
    const dropDeleted = (event: StorageEvent) => {
      if (event.key !== CLOUD_SYNC_CHECKPOINT_PREFIX + user.uid) return;
      dropDeletedOnServer(deletedOnServer(user.uid), localAttempts.current, dispatch);
    };
    window.addEventListener('storage', dropDeleted);
    return () => window.removeEventListener('storage', dropDeleted);
  }, [dispatch, user]);

  useEffect(() => {
    if (!user) return;
    const retry = () => {
      if (readyUserId === user.uid) {
        if (difficultSyncInFlight.current.has(user.uid)) retryDifficultAfterFlight.current.add(user.uid);
        else setDifficultSyncEpoch((value) => value + 1);
        setDeletionRetryEpoch((value) => value + 1);
      }
      else setCloudRetryEpoch((value) => value + 1);
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [readyUserId, user]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || readyUserId !== user.uid) return;
    const changes = state.difficultPendingChanges;
    if (!Object.keys(changes).length || difficultSyncInFlight.current.has(user.uid)) return;
    difficultSyncInFlight.current.add(user.uid);
    setStatus('syncing');
    const difficult = doc(firebase.db, 'users', user.uid, 'settings', 'difficult');
    void runTransaction(firebase.db, async (transaction) => {
      const snapshot = await transaction.get(difficult);
      const cloudIds = snapshot.exists() ? parseCloudDifficultSettings(snapshot.data()) : [];
      if (!cloudIds) throw new Error('Invalid cloud difficult settings');
      transaction.set(difficult, {
        questionIds: applyDifficultChanges(cloudIds, changes),
        updatedAt: new Date().toISOString(),
        syncedAt: serverTimestamp(),
      });
    })
      .then(() => {
        if (authenticatedUserId.current === user.uid) {
          dispatch({ type: 'confirm-difficult-changes', changes });
          setStatus('synced');
        }
        difficultSyncInFlight.current.delete(user.uid);
        retryDifficultAfterFlight.current.delete(user.uid);
        // A new mark made while this transaction ran must get its own transaction.
        setDifficultSyncEpoch((value) => value + 1);
      })
      .catch(() => {
        difficultSyncInFlight.current.delete(user.uid);
        const retryRequested = retryDifficultAfterFlight.current.delete(user.uid);
        if (authenticatedUserId.current === user.uid) {
          setError('最新難題標記仍保存在本機，恢復連線後會重試同步。');
          setStatus('error');
          // If the user changed another mark during the failed transaction, retry it once.
          const signature = (items: Record<string, boolean>) => JSON.stringify(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)));
          if (retryRequested || signature(changes) !== signature(latestDifficultChanges.current)) {
            setDifficultSyncEpoch((value) => value + 1);
          }
        }
      });
  }, [dispatch, readyUserId, state.difficultPendingChanges, user, difficultSyncEpoch]);

  const handleSignIn = useCallback(async () => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    setStatus('syncing');
    setError('');
    setSignInPending(true);
    try {
      // The whole page goes to Google and back. In an iPhone Home Screen web app a popup
      // cannot report being closed, so the button would stay on 登入中.
      await signInWithRedirect(firebase.auth, new GoogleAuthProvider());
    } catch (reason) {
      setSignInPending(false);
      setStatus('signed-out');
      setError(getFirebaseSignInErrorMessage(reason));
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    await signOut(firebase.auth);
  }, []);

  return (
    <CloudSyncContext.Provider
      value={{
        user,
        status: user && (progressSync.status === 'error' || progressSync.status === 'conflict') ? 'error'
          : user && progressSync.status === 'syncing' && status === 'synced' ? 'syncing'
          : user && progressSync.status === 'pending' && status === 'synced' ? 'pending' : status,
        error: user && (progressSync.status === 'error' || progressSync.status === 'conflict') ? progressSync.error : error,
        progressConflicts: user ? progressSync.conflicts ?? [] : [],
        syncProgressNow: () => window.dispatchEvent(new Event(PROGRESS_SYNC_NOW_EVENT)),
        resolveProgressConflict: (id, choice) => window.dispatchEvent(new CustomEvent(PROGRESS_RESOLVE_EVENT, { detail: { id, choice } })),
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      <ProgressSyncBridge userId={user?.uid ?? null} onStatus={setProgressSync} />
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const context = useOptionalCloudSync();
  if (!context) throw new Error('useCloudSync must be used within CloudSyncProvider');
  return context;
}

export function useOptionalCloudSync() {
  return useContext(CloudSyncContext);
}
