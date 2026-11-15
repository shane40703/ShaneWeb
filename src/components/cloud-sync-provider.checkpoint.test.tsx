import { act, cleanup, render } from '@testing-library/react';
import { useEffect, type Dispatch } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncProvider, useCloudSync } from '@/components/cloud-sync-provider';
import {
  CLOUD_SYNC_CHECKPOINT_PREFIX,
  OTHER_ATTEMPTS_RECHECK_MS,
} from '@/lib/cloud-sync-checkpoint';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { AppState, QuizAttempt } from '@/lib/types';
import type { AppAction } from '@/state/app-reducer';
import { AppStateProvider, useAppState } from '@/state/app-state';

type Data = Record<string, unknown>;
type Listener = (value: unknown) => void;

// A stand-in for Firestore 12 that keeps what the checkpoint relies on: a since-query holds
// the records whose server syncedAt is at or after its bound, an accepted write gets the
// server's clock, a count or a full read sees every record, and a pending deletion leaves the
// local view at once. A transaction reads from the server, shows nothing locally, and fails
// at its read when the rules refuse the log or the client is offline.
const firestore = vi.hoisted(() => ({
  clock: 10_000,
  // Sub-ms precision, as the server has: the checkpoint must round it down.
  stamp: (ms: number) => ({
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000 + 500,
  }),
  server: new Map<string, Record<string, unknown>>(),
  reads: [] as { path: string; after: number | null; ids?: string[] }[],
  // Documents read on their own: the deletion log and 難題標記.
  docReads: [] as string[],
  // How often each record's data() was called.
  decoded: new Map<string, number>(),
  counts: [] as string[],
  countFails: false,
  fullReadFromCache: false,
  writes: [] as string[],
  writeDelay: 100 as number | null,
  deletes: [] as string[],
  deleteDelay: 100,
  // Whether the deployed rules cover the deletion log; without them every use of it is refused.
  logRules: true,
  logReadFromCache: false,
  // What the log listener fails with, if anything.
  logListenError: null as string | null,
  logSubscriptions: 0,
  transactions: 0,
  // What each transaction's read fails with, if anything: 'unavailable' when offline.
  transactionError: null as string | null,
  transactionDelay: 100,
  // Attempts deleted by a committed transaction.
  transactionDeletes: [] as string[],
  // A listener resumed with nothing new reports from the cache only, and nothing after.
  listenersQuiet: false,
  // One per collection per page; two pages of one browser can be open at once.
  listeners: new Set<{
    path: string;
    after: number | null;
    next: (snapshot: unknown) => void;
  }>(),
  docListeners: new Set<{ path: string; next: Listener }>(),
}));

vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  getFirebaseServices: () => ({ db: {}, auth: {} }),
}));
vi.mock('@/components/progress-sync-bridge', () => ({ ProgressSyncBridge: () => null }));
vi.mock('@/lib/note-image-storage', () => ({
  readStoredNoteImages: async () => null,
  writeStoredNoteImages: async () => {},
  stateWithoutNoteImages: (state: object) => state,
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  getRedirectResult: () => Promise.resolve(null),
  onAuthStateChanged: (_auth: unknown, next: (user: unknown) => void) => {
    const timer = setTimeout(() => next({ uid: 'u1' }), 0);
    return () => clearTimeout(timer);
  },
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => {
  const parent = (path: string) => path.split('/').slice(0, -1).join('/');
  const isLog = (path: string) => path.endsWith('/deletions/attempts');
  const refusal = (code: string) => Object.assign(new Error(code), { code });
  const docSnapshot = (path: string, fromCache = false) => {
    const data = firestore.server.get(path);
    return {
      exists: () => data !== undefined,
      data: () => data,
      metadata: { fromCache, hasPendingWrites: false },
    };
  };
  const notifyDoc = (path: string) => {
    for (const listener of firestore.docListeners) {
      if (listener.path === path) setTimeout(() => listener.next(docSnapshot(path)));
    }
  };
  const millis = (value: unknown) => {
    const { seconds, nanoseconds } = value as { seconds: number; nanoseconds: number };
    return seconds * 1000 + nanoseconds / 1_000_000;
  };
  const item = ([path, data]: [string, Data]) => ({
    id: path.split('/').pop(),
    data: () => {
      firestore.decoded.set(path, (firestore.decoded.get(path) ?? 0) + 1);
      return data;
    },
    metadata: { hasPendingWrites: false },
  });
  const view = (
    collection: string,
    after: number | null,
    without?: string,
    ids?: string[],
  ) =>
    [...firestore.server].filter(
      ([path, data]) =>
        parent(path) === collection &&
        path !== without &&
        (after === null || millis(data.syncedAt) >= after) &&
        (!ids || ids.includes(path.split('/').pop() ?? '')),
    );
  /** The SDK raises listener events from a later task. */
  const notify = (
    type: 'added' | 'modified' | 'removed',
    path: string,
    data: Data,
    without?: string,
  ) => {
    if (firestore.listenersQuiet) return;
    for (const listener of firestore.listeners) {
      if (
        listener.path !== parent(path) ||
        (listener.after !== null && millis(data.syncedAt) < listener.after)
      ) {
        continue;
      }
      setTimeout(() =>
        listener.next({
          docChanges: () => [{ type, doc: item([path, data]) }],
          docs: view(parent(path), listener.after, without).map(item),
          metadata: { fromCache: false, hasPendingWrites: false },
        }),
      );
    }
  };
  return {
    collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
    doc: (base: { path?: string }, ...path: string[]) => ({
      path: [base.path, ...path].filter(Boolean).join('/'),
    }),
    documentId: () => '__name__',
    where: (_field: string, op: string, value: unknown) =>
      op === 'in' ? { ids: value as string[] } : { after: millis(value) },
    query: (
      target: { path: string },
      constraint: { after?: number; ids?: string[] },
    ) => ({ path: target.path, ...constraint }),
    Timestamp: {
      fromMillis: (ms: number) => ({
        seconds: Math.floor(ms / 1000),
        nanoseconds: (ms % 1000) * 1_000_000,
      }),
    },
    serverTimestamp: () => 'SERVER_TIME',
    getDocs: async (target: { path: string; after?: number; ids?: string[] }) => {
      const after = target.after ?? null;
      const { ids } = target;
      firestore.reads.push({ path: target.path, after, ...(ids && { ids }) });
      return {
        docs: view(target.path, after, undefined, ids).map(item),
        metadata: {
          fromCache: !ids && after === null && firestore.fullReadFromCache,
        },
      };
    },
    getCountFromServer: async (target: { path: string }) => {
      firestore.counts.push(target.path);
      if (firestore.countFails)
        throw Object.assign(new Error('Offline.'), { code: 'unavailable' });
      return { data: () => ({ count: view(target.path, null).length }) };
    },
    getDoc: async (target: { path: string }) => {
      firestore.docReads.push(target.path);
      if (isLog(target.path) && !firestore.logRules) throw refusal('permission-denied');
      return docSnapshot(target.path, isLog(target.path) && firestore.logReadFromCache);
    },
    runTransaction: async (
      _db: unknown,
      update: (transaction: unknown) => Promise<unknown>,
    ) => {
      firestore.transactions += 1;
      const writes: [string, Data | null][] = [];
      const transaction = {
        get: async (target: { path: string }) => {
          if (isLog(target.path) && !firestore.logRules)
            throw refusal('permission-denied');
          if (firestore.transactionError) throw refusal(firestore.transactionError);
          return docSnapshot(target.path);
        },
        delete: (target: { path: string }) => {
          writes.push([target.path, null]);
          return transaction;
        },
        set: (target: { path: string }, data: Data) => {
          writes.push([target.path, data]);
          return transaction;
        },
      };
      const result = await update(transaction);
      await new Promise((resolve) => setTimeout(resolve, firestore.transactionDelay));
      // Committed all at once, on the server's clock.
      firestore.clock += 1_000;
      for (const [path, data] of writes) {
        if (data) {
          firestore.server.set(path, {
            ...data,
            syncedAt: firestore.stamp(firestore.clock),
          });
          notifyDoc(path);
          continue;
        }
        firestore.transactionDeletes.push(path);
        const previous = firestore.server.get(path);
        firestore.server.delete(path);
        if (previous) notify('removed', path, previous);
      }
      return result;
    },
    onSnapshot: (target: { path: string; after?: number }, ...rest: unknown[]) => {
      const [next, error] = rest.filter(
        (item): item is Listener => typeof item === 'function',
      );
      // A document: the deletion log, or 難題標記.
      if (target.path.split('/').length % 2 === 0) {
        const docListener = { path: target.path, next };
        if (isLog(target.path)) firestore.logSubscriptions += 1;
        firestore.docListeners.add(docListener);
        setTimeout(() => {
          const code = !isLog(target.path)
            ? null
            : !firestore.logRules
              ? 'permission-denied'
              : firestore.logListenError;
          if (!code) return next(docSnapshot(target.path));
          // The SDK drops a listener when it fails.
          firestore.docListeners.delete(docListener);
          error?.(refusal(code));
        });
        return () => firestore.docListeners.delete(docListener);
      }
      const listener = { path: target.path, after: target.after ?? null, next };
      firestore.listeners.add(listener);
      const entries = view(target.path, listener.after);
      setTimeout(() =>
        next({
          docChanges: () => entries.map((entry) => ({ type: 'added', doc: item(entry) })),
          docs: entries.map(item),
          exists: () => false,
          metadata: { fromCache: firestore.listenersQuiet, hasPendingWrites: false },
        }),
      );
      return () => firestore.listeners.delete(listener);
    },
    setDoc: (target: { path: string }, data: Data) => {
      firestore.writes.push(target.path);
      const delay = firestore.writeDelay;
      if (delay === null) return new Promise(() => {});
      return new Promise((resolve) =>
        setTimeout(() => {
          const existed = firestore.server.has(target.path);
          firestore.clock += 1_000;
          const accepted = { ...data, syncedAt: firestore.stamp(firestore.clock) };
          firestore.server.set(target.path, accepted);
          resolve(undefined);
          notify(existed ? 'modified' : 'added', target.path, accepted);
        }, delay),
      );
    },
    deleteDoc: (target: { path: string }) => {
      firestore.deletes.push(target.path);
      const previous = firestore.server.get(target.path);
      // The local view drops the record before the server answers.
      if (previous) notify('removed', target.path, previous, target.path);
      return new Promise((resolve) =>
        setTimeout(() => {
          firestore.server.delete(target.path);
          resolve(undefined);
        }, firestore.deleteDelay),
      );
    },
  };
});

const controls: {
  state: AppState | null;
  dispatch: Dispatch<AppAction>;
  status?: string;
  error?: string;
} = {
  state: null,
  dispatch: () => {},
};
// Pages open side by side, by name.
const tabs: Record<string, typeof controls> = {};

function Controls({ tab }: { tab?: string }) {
  const { state, dispatch } = useAppState();
  const { status, error } = useCloudSync();
  useEffect(() => {
    if (tab) {
      tabs[tab] = { state, dispatch, status, error };
      return;
    }
    controls.state = state;
    controls.dispatch = dispatch;
    controls.status = status;
    controls.error = error;
  }, [tab, state, dispatch, status, error]);
  return null;
}

const NOTE = 'law-114-01';
const OTHER_NOTE = 'law-114-02';
const V1 = '2026-11-12T10:00:00.000Z';
const V2 = '2026-11-12T10:30:00.000Z';
const CHECKPOINT_KEY = `${CLOUD_SYNC_CHECKPOINT_PREFIX}u1`;
const attemptsPath = 'users/u1/attempts';
const notesPath = 'users/u1/notes';
const logPath = 'users/u1/deletions/attempts';
const HOUR = 60 * 60_000;

function savedAttempt(id: string): QuizAttempt {
  return {
    id,
    mode: 'practice',
    subject: 'law',
    year: null,
    questionIds: ['law-114-01'],
    answers: { 'law-114-01': 1 },
    startedAt: '2026-11-12T00:00:00.000Z',
    submittedAt: '2026-11-12T00:01:00.000Z',
    elapsedSeconds: 60,
    correctCount: 1,
    wrongCount: 0,
    unansweredCount: 0,
  };
}

function onServer(id: string, syncedAt: number) {
  firestore.server.set(`${attemptsPath}/${id}`, {
    ...savedAttempt(id),
    syncedAt: firestore.stamp(syncedAt),
  });
}

function noteOnServer(questionId: string, updatedAt: string, syncedAt: number) {
  firestore.server.set(`${notesPath}/${questionId}`, {
    questionId,
    content: `筆記 ${updatedAt}`,
    updatedAt,
    syncedAt: firestore.stamp(syncedAt),
  });
}

function onThisDevice(attemptIds: string[], notes: Record<string, string> = {}) {
  const state = createDefaultState();
  state.attempts = attemptIds.map(savedAttempt);
  for (const [questionId, updatedAt] of Object.entries(notes)) {
    state.notes[questionId] = `筆記 ${updatedAt}`;
    state.noteUpdatedAt[questionId] = updatedAt;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Deleted on some device and added to the account's deletion log, oldest first. */
function logged(...attemptIds: string[]) {
  const previous = (firestore.server.get(logPath)?.attemptIds ?? []) as string[];
  attemptIds.forEach((id) => firestore.server.delete(`${attemptsPath}/${id}`));
  firestore.server.set(logPath, {
    attemptIds: [...previous, ...attemptIds],
    syncedAt: firestore.stamp((firestore.clock += 1_000)),
  });
}

const serverLog = () => firestore.server.get(logPath)?.attemptIds;

function checkpoint(values: {
  attemptsAfter?: number;
  notesAfter?: number;
  attemptIds?: string[];
  otherAttemptIds?: string[];
  otherCheckedAt?: number;
  deletedAttemptIds?: string[];
  noteVersions?: Record<string, string>;
}) {
  localStorage.setItem(
    CHECKPOINT_KEY,
    JSON.stringify({
      version: 1,
      attemptsAfter: 0,
      notesAfter: 0,
      attemptIds: [],
      noteVersions: {},
      ...values,
    }),
  );
}

const savedCheckpoint = () => JSON.parse(localStorage.getItem(CHECKPOINT_KEY) ?? 'null');
const sorted = (ids: string[]) => [...ids].sort();
const localAttemptIds = () =>
  sorted(controls.state?.attempts.map((attempt) => attempt.id) ?? []);
const tabAttemptIds = (tab: string) =>
  sorted(tabs[tab]?.state?.attempts.map((attempt) => attempt.id) ?? []);
const writesTo = (path: string) =>
  firestore.writes.filter((write) => write === path).length;
/** The latest listener on a collection. */
const listenerOn = (path: string) =>
  [...firestore.listeners].findLast((listener) => listener.path === path);

/** Lets fake time pass in small steps, so React renders and runs effects between them. */
async function pass(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 20) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
  }
}

async function load() {
  render(
    <AppStateProvider>
      <CloudSyncProvider>
        <Controls />
      </CloudSyncProvider>
    </AppStateProvider>,
  );
  await pass(500);
  expect(listenerOn(attemptsPath)).toBeDefined();
  expect(listenerOn(notesPath)).toBeDefined();
}

/** Pages of one browser open at once: they share its storage, each with its own listeners. */
async function openTabs(...names: string[]) {
  names.forEach((name) =>
    render(
      <AppStateProvider>
        <CloudSyncProvider>
          <Controls tab={name} />
        </CloudSyncProvider>
      </AppStateProvider>,
    ),
  );
  await pass(500);
}

/** A page closed and opened again in the same browser. */
async function reload() {
  cleanup();
  firestore.reads = [];
  firestore.counts = [];
  await load();
}

/** Another device deletes these and logs them, as this page's log listener reports it. */
async function deletedElsewhere(...attemptIds: string[]) {
  logged(...attemptIds);
  const data = firestore.server.get(logPath);
  await act(async () => {
    for (const listener of firestore.docListeners) {
      if (listener.path !== logPath) continue;
      listener.next({
        exists: () => true,
        data: () => data,
        metadata: { fromCache: false, hasPendingWrites: false },
      });
    }
  });
}

/** A change another device made, as this page's listener reports it. */
async function elsewhere(
  type: 'added' | 'modified' | 'removed',
  path: string,
  data: Data = firestore.server.get(path) ?? {},
) {
  if (type === 'removed') firestore.server.delete(path);
  else firestore.server.set(path, data);
  const listener = listenerOn(path.split('/').slice(0, -1).join('/'));
  const docs = [...firestore.server]
    .filter(([key]) => key.startsWith(`${path.split('/').slice(0, -1).join('/')}/`))
    .map(([key, value]) => ({
      id: key.split('/').pop(),
      data: () => value,
      metadata: { hasPendingWrites: false },
    }));
  await act(async () =>
    listener?.next({
      docChanges: () => [
        {
          type,
          doc: {
            id: path.split('/').pop(),
            data: () => data,
            metadata: { hasPendingWrites: false },
          },
        },
      ],
      docs,
      metadata: { fromCache: false, hasPendingWrites: false },
    }),
  );
}

describe('CloudSyncProvider checkpoint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    firestore.clock = 10_000;
    firestore.server.clear();
    firestore.reads = [];
    firestore.docReads = [];
    firestore.decoded.clear();
    firestore.counts = [];
    firestore.countFails = false;
    firestore.fullReadFromCache = false;
    firestore.writes = [];
    firestore.writeDelay = 100;
    firestore.deletes = [];
    firestore.deleteDelay = 100;
    firestore.logRules = true;
    firestore.logReadFromCache = false;
    firestore.logListenError = null;
    firestore.logSubscriptions = 0;
    firestore.transactions = 0;
    firestore.transactionError = null;
    firestore.transactionDelay = 100;
    firestore.transactionDeletes = [];
    firestore.listenersQuiet = false;
    firestore.listeners.clear();
    firestore.docListeners.clear();
    controls.state = null;
    Object.keys(tabs).forEach((tab) => delete tabs[tab]);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reads only what was synced since the checkpoint, plus one count', async () => {
    onServer('a1', 1_000);
    onServer('a2', 2_000);
    // Synced from another device after this browser last read.
    onServer('a3', 3_000);
    noteOnServer(NOTE, V1, 1_500);
    onThisDevice(['a1', 'a2'], { [NOTE]: V1 });
    checkpoint({
      attemptsAfter: 2_000,
      notesAfter: 1_500,
      attemptIds: ['a1', 'a2'],
      noteVersions: { [NOTE]: V1 },
    });
    await load();
    expect(firestore.reads).toEqual([
      { path: attemptsPath, after: 2_000 },
      { path: notesPath, after: 1_500 },
    ]);
    expect(firestore.counts).toEqual([attemptsPath]);
    // The deletion log and 難題標記, then a listener on each.
    expect(firestore.docReads).toEqual([logPath, 'users/u1/settings/difficult']);
    expect(firestore.logSubscriptions).toBe(1);
    expect(firestore.writes).toEqual([]);
    expect(localAttemptIds()).toEqual(['a1', 'a2', 'a3']);
    expect(savedCheckpoint()).toMatchObject({ attemptsAfter: 3_000, notesAfter: 1_500 });
    expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a2', 'a3']);
    // The listeners start from what this page has read.
    expect(listenerOn(attemptsPath)?.after).toBe(3_000);
    expect(listenerOn(notesPath)?.after).toBe(1_500);
  });

  describe('when the count differs from the checkpoint', () => {
    beforeEach(() => {
      // a2 is gone from the server; a9 was made here and never uploaded.
      onServer('a1', 1_000);
      onThisDevice(['a1', 'a2', 'a9']);
      checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1', 'a2'] });
    });

    it('takes a record gone from the server that the log does not list for lost, and sends it again', async () => {
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 1_000 },
        { path: attemptsPath, after: null },
        { path: notesPath, after: 0 },
      ]);
      expect(localAttemptIds()).toEqual(['a1', 'a2', 'a9']);
      expect(sorted(firestore.writes)).toEqual([
        `${attemptsPath}/a2`,
        `${attemptsPath}/a9`,
      ]);
      expect(firestore.server.has(`${attemptsPath}/a2`)).toBe(true);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a2', 'a9']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual([]);
    });

    it('needs no full read when the log lists it: it only leaves this device', async () => {
      logged('a2');
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 1_000 },
        { path: notesPath, after: 0 },
      ]);
      expect(firestore.counts).toEqual([attemptsPath]);
      expect(localAttemptIds()).toEqual(['a1', 'a9']);
      expect(firestore.writes).toEqual([`${attemptsPath}/a9`]);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a9']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual(['a2']);
    });

    it('removes the missing records the log lists and sends the others again', async () => {
      // a3 is gone too, and no device logged it.
      onThisDevice(['a1', 'a2', 'a3', 'a9']);
      checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1', 'a2', 'a3'] });
      logged('a2');
      await load();
      expect(firestore.reads).toContainEqual({ path: attemptsPath, after: null });
      expect(localAttemptIds()).toEqual(['a1', 'a3', 'a9']);
      expect(sorted(firestore.writes)).toEqual([
        `${attemptsPath}/a3`,
        `${attemptsPath}/a9`,
      ]);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a3', 'a9']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual(['a2']);
    });

    it('removes nothing when the full read comes from the cache', async () => {
      firestore.fullReadFromCache = true;
      await load();
      expect(firestore.reads).toContainEqual({ path: attemptsPath, after: null });
      expect(localAttemptIds()).toEqual(['a1', 'a2', 'a9']);
      expect(firestore.writes).toEqual([`${attemptsPath}/a9`]);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a2', 'a9']);
    });

    it('checks nothing for this load when the count fails', async () => {
      firestore.countFails = true;
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 1_000 },
        { path: notesPath, after: 0 },
      ]);
      expect(localAttemptIds()).toEqual(['a1', 'a2', 'a9']);
      expect(firestore.writes).toEqual([`${attemptsPath}/a9`]);
    });
  });

  it('still uploads local attempts the server does not have', async () => {
    onServer('a1', 1_000);
    onThisDevice(['a1', 'a9']);
    checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1'] });
    // No listener reports the upload: the server's answer alone adds it to the checkpoint.
    firestore.listenersQuiet = true;
    await load();
    expect(firestore.reads).not.toContainEqual({ path: attemptsPath, after: null });
    expect(firestore.writes).toEqual([`${attemptsPath}/a9`]);
    expect(firestore.server.has(`${attemptsPath}/a9`)).toBe(true);
    expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a9']);
  });

  it('adds later writes to the checkpoint once the server accepts them', async () => {
    onServer('a1', 1_000);
    onThisDevice(['a1']);
    checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1'] });
    firestore.listenersQuiet = true;
    firestore.writeDelay = 1_000;
    await load();
    await act(async () => {
      controls.dispatch({
        type: 'save-attempt',
        attempt: savedAttempt('a5'),
        results: { 'law-114-01': true },
      });
      controls.dispatch({
        type: 'save-note',
        questionId: NOTE,
        content: '新筆記',
        updatedAt: V2,
      });
    });
    await pass(500);
    // Sent, but not yet accepted.
    expect(firestore.writes).toEqual([`${attemptsPath}/a5`, `${notesPath}/${NOTE}`]);
    expect(savedCheckpoint()).toMatchObject({ attemptIds: ['a1'], noteVersions: {} });
    await pass(1_000);
    expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a5']);
    expect(savedCheckpoint().noteVersions).toEqual({ [NOTE]: V2 });
  });

  it.each([
    [
      'an attempt this browser no longer holds',
      { attemptsAfter: 9_000, attemptIds: ['a1', 'a-gone'] },
      {},
      // Confirmed on the server once and gone from it since, but no log lists it: lost, and
      // this browser has no copy to send again.
      [],
    ],
    [
      'a newer note than this browser holds',
      { attemptsAfter: 9_000, attemptIds: ['a1'], noteVersions: { [NOTE]: V2 } },
      { [NOTE]: V1 },
      [],
    ],
  ])(
    'reads in full with a checkpoint listing %s, and starts it over',
    async (_name, stale, localNotes, deletedAttemptIds) => {
      onServer('a1', 1_000);
      onServer('a2', 2_000);
      noteOnServer(NOTE, V2, 1_500);
      onThisDevice(['a1'], localNotes);
      checkpoint(stale);
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: null },
        { path: notesPath, after: null },
      ]);
      expect(firestore.counts).toEqual([]);
      expect(localAttemptIds()).toEqual(['a1', 'a2']);
      expect(controls.state?.noteUpdatedAt[NOTE]).toBe(V2);
      expect({
        ...savedCheckpoint(),
        attemptIds: sorted(savedCheckpoint().attemptIds),
      }).toEqual({
        version: 1,
        attemptsAfter: 2_000,
        notesAfter: 1_500,
        attemptIds: ['a1', 'a2'],
        otherAttemptIds: [],
        otherCheckedAt: expect.any(Number),
        deletedAttemptIds,
        noteVersions: { [NOTE]: V2 },
      });
    },
  );

  describe('when the checkpoint no longer stands', () => {
    beforeEach(() => {
      // a3 came through another page's listener, then a page with older data saved over it:
      // this browser no longer covers the checkpoint. a2 is gone from the server; a9 was made
      // here and never uploaded.
      onServer('a1', 1_000);
      onServer('a3', 3_000);
      onThisDevice(['a1', 'a2', 'a9']);
      checkpoint({ attemptsAfter: 3_000, attemptIds: ['a1', 'a2', 'a3'] });
    });

    it('still removes what the log lists, and never sends it', async () => {
      logged('a2');
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: null },
        { path: notesPath, after: null },
      ]);
      expect(localAttemptIds()).toEqual(['a1', 'a3', 'a9']);
      expect(firestore.writes).toEqual([`${attemptsPath}/a9`]);
      expect(firestore.server.has(`${attemptsPath}/a2`)).toBe(false);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a3', 'a9']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual(['a2']);
    });

    it('sends again what is gone from the server when no log lists it', async () => {
      await load();
      expect(localAttemptIds()).toEqual(['a1', 'a2', 'a3', 'a9']);
      expect(sorted(firestore.writes)).toEqual([
        `${attemptsPath}/a2`,
        `${attemptsPath}/a9`,
      ]);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a2', 'a3', 'a9']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual([]);
    });

    it('removes nothing when the full read comes from the cache', async () => {
      firestore.fullReadFromCache = true;
      await load();
      expect(localAttemptIds()).toEqual(['a1', 'a2', 'a3', 'a9']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual([]);
    });

    it('takes many gone at once for lost server data: removes none and sends them again', async () => {
      const all = Array.from({ length: 24 }, (_, index) => `b${index + 10}`);
      firestore.server.clear();
      onServer('b10', 1_000);
      onServer('b11', 2_000);
      onThisDevice(all);
      // Lists one this browser no longer holds, so it no longer stands.
      checkpoint({ attemptsAfter: 2_000, attemptIds: [...all, 'b99'] });
      await load();
      expect(firestore.reads).toContainEqual({ path: attemptsPath, after: null });
      expect(localAttemptIds()).toEqual(all);
      expect(sorted(firestore.writes)).toEqual(
        all.slice(2).map((id) => `${attemptsPath}/${id}`),
      );
      expect(savedCheckpoint().deletedAttemptIds).toEqual([]);
    });
  });

  it('starts a checkpoint at a first full read, so the next load reads only what is new', async () => {
    onServer('a1', 1_000);
    noteOnServer(NOTE, V1, 1_500);
    await load();
    expect(firestore.reads).toEqual([
      { path: attemptsPath, after: null },
      { path: notesPath, after: null },
    ]);
    expect(savedCheckpoint()).toEqual({
      version: 1,
      attemptsAfter: 1_000,
      notesAfter: 1_500,
      attemptIds: ['a1'],
      otherAttemptIds: [],
      // The full read has read every record this app cannot read: none.
      otherCheckedAt: expect.any(Number),
      deletedAttemptIds: [],
      noteVersions: { [NOTE]: V1 },
    });
    onServer('a2', 2_000);
    await reload();
    expect(firestore.reads).toEqual([
      { path: attemptsPath, after: 1_000 },
      { path: notesPath, after: 1_500 },
    ]);
    expect(firestore.counts).toEqual([attemptsPath]);
    expect(localAttemptIds()).toEqual(['a1', 'a2']);
    expect(firestore.writes).toEqual([]);
  });

  describe('deleting an attempt', () => {
    beforeEach(() => {
      onServer('a1', 1_000);
      onServer('a2', 2_000);
      onThisDevice(['a1', 'a2']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1', 'a2'] });
    });
    const remove = (...attemptIds: string[]) =>
      act(async () =>
        attemptIds.forEach((attemptId) =>
          controls.dispatch({ type: 'delete-attempt', attemptId }),
        ),
      );

    it('deletes it and logs it in one transaction, then drops it from the checkpoint', async () => {
      firestore.transactionDelay = 1_000;
      await load();
      await remove('a1');
      await pass(500);
      // On its way: the server has neither change yet.
      expect(firestore.transactions).toBe(1);
      expect(firestore.server.has(`${attemptsPath}/a1`)).toBe(true);
      expect(serverLog()).toBeUndefined();
      expect(savedCheckpoint().attemptIds).toEqual(['a1', 'a2']);
      await pass(1_000);
      expect(firestore.transactionDeletes).toEqual([`${attemptsPath}/a1`]);
      expect(serverLog()).toEqual(['a1']);
      expect(firestore.server.get(logPath)?.syncedAt).toEqual(
        firestore.stamp(firestore.clock),
      );
      expect(firestore.deletes).toEqual([]);
      expect(savedCheckpoint()).toMatchObject({
        attemptIds: ['a2'],
        deletedAttemptIds: ['a1'],
      });
      expect(controls.state?.deletedAttemptIds).toEqual([]);
      expect(controls.status).toBe('synced');
    });

    it('sends every pending deletion in one transaction, oldest first', async () => {
      logged('a0');
      await load();
      await remove('a1', 'a2');
      await pass(500);
      expect(firestore.transactions).toBe(1);
      expect(serverLog()).toEqual(['a0', 'a1', 'a2']);
      expect(sorted(firestore.transactionDeletes)).toEqual([
        `${attemptsPath}/a1`,
        `${attemptsPath}/a2`,
      ]);
      expect(controls.state?.deletedAttemptIds).toEqual([]);
    });

    it('deletes it as before while the rules do not cover the log', async () => {
      firestore.logRules = false;
      await load();
      await remove('a1');
      await pass(500);
      // The transaction is refused at its read of the log.
      expect(firestore.transactions).toBe(1);
      expect(firestore.deletes).toEqual([`${attemptsPath}/a1`]);
      expect(firestore.server.has(`${attemptsPath}/a1`)).toBe(false);
      expect(serverLog()).toBeUndefined();
      expect(savedCheckpoint()).toMatchObject({
        attemptIds: ['a2'],
        deletedAttemptIds: ['a1'],
      });
      expect(controls.state?.deletedAttemptIds).toEqual([]);
      expect(controls.status).toBe('synced');
    });

    it('keeps it pending when the transaction fails offline, and sends it again once online', async () => {
      await load();
      firestore.transactionError = 'unavailable';
      await remove('a1');
      await pass(500);
      expect(firestore.transactions).toBe(1);
      // Neither deleted unlogged nor dropped: still to send.
      expect(firestore.deletes).toEqual([]);
      expect(firestore.server.has(`${attemptsPath}/a1`)).toBe(true);
      expect(controls.state?.deletedAttemptIds).toEqual(['a1']);
      expect(localAttemptIds()).toEqual(['a2']);
      expect(controls.status).toBe('error');
      expect(controls.error).toBe('紀錄已從本機移除，恢復連線後會自動刪除雲端紀錄。');
      // A timer tries again too, in case the browser never says it was offline: after
      // 1 min, then 2 min more, each wait twice the last.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(firestore.transactions).toBe(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(firestore.transactions).toBe(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(firestore.transactions).toBe(3);
      firestore.transactionError = null;
      await act(async () => window.dispatchEvent(new Event('online')));
      await pass(500);
      expect(firestore.transactions).toBe(4);
      expect(firestore.server.has(`${attemptsPath}/a1`)).toBe(false);
      expect(serverLog()).toEqual(['a1']);
      expect(controls.state?.deletedAttemptIds).toEqual([]);
      expect(savedCheckpoint().deletedAttemptIds).toEqual(['a1']);
    });

    it('sends a deletion that failed offline again at the next load', async () => {
      await load();
      firestore.transactionError = 'unavailable';
      await remove('a1');
      await pass(500);
      expect(controls.state?.deletedAttemptIds).toEqual(['a1']);
      firestore.transactionError = null;
      await reload();
      await pass(500);
      expect(firestore.transactions).toBe(2);
      expect(serverLog()).toEqual(['a1']);
      expect(controls.state?.deletedAttemptIds).toEqual([]);
      expect(localAttemptIds()).toEqual(['a2']);
    });
  });

  describe('with a deletion log on the server', () => {
    it('drops at load the attempts it lists, and never sends them', async () => {
      onServer('a2', 2_000);
      // a3 is a copy a stale tab saved back here before it was ever uploaded.
      onThisDevice(['a1', 'a2', 'a3']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1', 'a2'] });
      logged('a3', 'a1');
      await load();
      // The count leaves out what the log lists: no full read.
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 2_000 },
        { path: notesPath, after: 0 },
      ]);
      expect(localAttemptIds()).toEqual(['a2']);
      expect(firestore.writes).toEqual([]);
      expect(savedCheckpoint()).toMatchObject({
        attemptIds: ['a2'],
        deletedAttemptIds: ['a3', 'a1'],
      });
    });

    it('drops them at a first load in this browser too', async () => {
      onServer('a2', 2_000);
      onThisDevice(['a1', 'a2']);
      logged('a1');
      await load();
      expect(firestore.reads).toContainEqual({ path: attemptsPath, after: null });
      expect(localAttemptIds()).toEqual(['a2']);
      expect(firestore.writes).toEqual([]);
      expect(savedCheckpoint()).toMatchObject({
        attemptIds: ['a2'],
        deletedAttemptIds: ['a1'],
      });
    });

    it('does not merge a listed record the server holds again, and deletes it again', async () => {
      onServer('a1', 1_000);
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1'] });
      logged('a5');
      // A device that missed the deletion sent it back; a6 is new from another device, so
      // the attempts listener starts after a5 and only the load sees it.
      onServer('a5', 3_000);
      onServer('a6', 4_000);
      await load();
      expect(listenerOn(attemptsPath)?.after).toBe(4_000);
      // The since-read found it, so the count expects it: no full read.
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 2_000 },
        { path: notesPath, after: 0 },
      ]);
      expect(localAttemptIds()).toEqual(['a1', 'a6']);
      // Listed already: a plain deletion is enough.
      expect(firestore.deletes).toEqual([`${attemptsPath}/a5`]);
      expect(firestore.transactions).toBe(0);
      expect(firestore.server.has(`${attemptsPath}/a5`)).toBe(false);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a6']);
      expect(savedCheckpoint().deletedAttemptIds).toEqual(['a5']);
      await reload();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 4_000 },
        { path: notesPath, after: 0 },
      ]);
      expect(localAttemptIds()).toEqual(['a1', 'a6']);
      expect(firestore.deletes).toEqual([`${attemptsPath}/a5`]);
    });

    it('logs a copy sent back of a deletion only this browser knows, while deleting it again', async () => {
      onServer('a1', 1_000);
      onServer('a5', 3_000);
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1'], deletedAttemptIds: ['a5'] });
      await load();
      expect(localAttemptIds()).toEqual(['a1']);
      expect(firestore.transactions).toBe(1);
      expect(firestore.transactionDeletes).toEqual([`${attemptsPath}/a5`]);
      expect(firestore.deletes).toEqual([]);
      expect(serverLog()).toEqual(['a5']);
      expect(firestore.writes).toEqual([]);
      expect(savedCheckpoint().attemptIds).toEqual(['a1']);
    });

    it('does not merge a deleted record the attempts listener reports again', async () => {
      onServer('a1', 1_000);
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1'] });
      logged('a7');
      await load();
      await elsewhere('added', `${attemptsPath}/a7`, {
        ...savedAttempt('a7'),
        syncedAt: firestore.stamp(20_000),
      });
      expect(localAttemptIds()).toEqual(['a1']);
      expect(savedCheckpoint().attemptIds).toEqual(['a1']);
      await pass(500);
      expect(firestore.deletes).toEqual([`${attemptsPath}/a7`]);
      expect(firestore.server.has(`${attemptsPath}/a7`)).toBe(false);
    });

    it('drops from an open page an older attempt deleted on another device', async () => {
      onServer('a1', 1_000);
      onServer('a2', 2_000);
      onThisDevice(['a1', 'a2']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1', 'a2'] });
      await load();
      // a1 is older than what the attempts listener reads from: only the log tells.
      expect(listenerOn(attemptsPath)?.after).toBe(2_000);
      await deletedElsewhere('a1');
      expect(localAttemptIds()).toEqual(['a2']);
      expect(savedCheckpoint()).toMatchObject({
        attemptIds: ['a2'],
        deletedAttemptIds: ['a1'],
      });
      await pass(500);
      expect(firestore.writes).toEqual([]);
    });
  });

  describe('while the rules do not cover the deletion log', () => {
    beforeEach(() => {
      firestore.logRules = false;
    });

    it('loads as before, without an error, and never asks for the log on a timer', async () => {
      onServer('a1', 1_000);
      onServer('a3', 3_000);
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1'] });
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 1_000 },
        { path: notesPath, after: 0 },
      ]);
      expect(localAttemptIds()).toEqual(['a1', 'a3']);
      expect(controls.status).toBe('synced');
      expect(firestore.logSubscriptions).toBe(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(24 * HOUR);
      });
      expect(firestore.logSubscriptions).toBe(1);
      expect(controls.status).toBe('synced');
    });

    it('still removes the deletions this browser saw', async () => {
      onServer('a1', 1_000);
      onThisDevice(['a1', 'a2']);
      checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1'], deletedAttemptIds: ['a2'] });
      await load();
      expect(localAttemptIds()).toEqual(['a1']);
      expect(firestore.writes).toEqual([]);
    });
  });

  it('deletes again a copy it sent back as lost once the log listener lists it', async () => {
    onServer('a1', 1_000);
    onThisDevice(['a1', 'a2']);
    checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1', 'a2'] });
    // Another device deleted a2 and logged it, but this load read the log from the cache.
    logged('a2');
    firestore.server.delete(`${attemptsPath}/a2`);
    firestore.logReadFromCache = true;
    await load();
    // Not knowing better, the load sent a2 back as lost; the listener then names it.
    expect(firestore.writes).toEqual([`${attemptsPath}/a2`]);
    await pass(500);
    expect(localAttemptIds()).toEqual(['a1']);
    // Listed already: a plain delete, no transaction.
    expect(firestore.deletes).toEqual([`${attemptsPath}/a2`]);
    expect(firestore.transactions).toBe(0);
    expect(firestore.server.has(`${attemptsPath}/a2`)).toBe(false);
    expect(savedCheckpoint()).toMatchObject({
      attemptIds: ['a1'],
      deletedAttemptIds: ['a2'],
    });
  });

  it('goes by the checkpoint alone when the log comes from the cache', async () => {
    onServer('a1', 1_000);
    onThisDevice(['a1', 'a2']);
    checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1', 'a2'] });
    logged('a2');
    firestore.logReadFromCache = true;
    // Only the listener's answer from the server tells this page.
    firestore.logListenError = 'resource-exhausted';
    await load();
    // Without the log, a2 gone from the server looks lost and is sent again.
    expect(firestore.reads).toContainEqual({ path: attemptsPath, after: null });
    expect(firestore.writes).toEqual([`${attemptsPath}/a2`]);
  });

  it('subscribes to the log again after a failure a timer can fix, less often each time', async () => {
    firestore.logListenError = 'resource-exhausted';
    await load();
    expect(firestore.logSubscriptions).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(firestore.logSubscriptions).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(firestore.logSubscriptions).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(firestore.logSubscriptions).toBe(3);
  });

  it('keeps the checkpoint up to date from the listeners', async () => {
    onServer('a1', 1_000);
    onThisDevice(['a1']);
    checkpoint({ attemptsAfter: 1_000, attemptIds: ['a1'] });
    await load();
    await elsewhere('added', `${attemptsPath}/a4`, {
      ...savedAttempt('a4'),
      syncedAt: firestore.stamp(20_000),
    });
    expect(localAttemptIds()).toEqual(['a1', 'a4']);
    expect(savedCheckpoint()).toMatchObject({ attemptsAfter: 20_000 });
    expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'a4']);
    await elsewhere('removed', `${attemptsPath}/a4`);
    expect(localAttemptIds()).toEqual(['a1']);
    expect(savedCheckpoint()).toMatchObject({
      attemptIds: ['a1'],
      deletedAttemptIds: ['a4'],
    });
    await elsewhere('added', `${notesPath}/${OTHER_NOTE}`, {
      questionId: OTHER_NOTE,
      content: '另一台的筆記',
      updatedAt: V2,
      syncedAt: firestore.stamp(21_000),
    });
    expect(controls.state?.noteUpdatedAt[OTHER_NOTE]).toBe(V2);
    expect(savedCheckpoint()).toMatchObject({
      notesAfter: 21_000,
      noteVersions: { [OTHER_NOTE]: V2 },
    });
  });

  it('offers a newer note again after the server went back to an older one', async () => {
    // V2 was confirmed earlier; then another device's late write took the server back to V1.
    noteOnServer(NOTE, V1, 2_000);
    noteOnServer(OTHER_NOTE, V1, 3_000);
    onThisDevice([], { [NOTE]: V2, [OTHER_NOTE]: V1 });
    checkpoint({ notesAfter: 1_000, noteVersions: { [NOTE]: V2, [OTHER_NOTE]: V1 } });
    // The page closes before the server answers the resend.
    firestore.writeDelay = null;
    await load();
    expect(writesTo(`${notesPath}/${NOTE}`)).toBe(1);
    expect(savedCheckpoint()).toMatchObject({
      notesAfter: 3_000,
      noteVersions: { [NOTE]: V1, [OTHER_NOTE]: V1 },
    });
    // The next load no longer reads that note, but still knows the server has the older one.
    firestore.writeDelay = 100;
    await reload();
    expect(firestore.reads).toContainEqual({ path: notesPath, after: 3_000 });
    expect(writesTo(`${notesPath}/${NOTE}`)).toBe(2);
    expect(firestore.server.get(`${notesPath}/${NOTE}`)).toMatchObject({ updatedAt: V2 });
    expect(savedCheckpoint().noteVersions[NOTE]).toBe(V2);
  });

  it('counts server records this app cannot read, so they cost no full read', async () => {
    onServer('a1', 1_000);
    // Saved by another version of the app, with a subject this one does not know.
    firestore.server.set(`${attemptsPath}/x1`, {
      ...savedAttempt('x1'),
      subject: 'future',
      syncedAt: firestore.stamp(1_500),
    });
    await load();
    expect(localAttemptIds()).toEqual(['a1']);
    expect(savedCheckpoint()).toMatchObject({
      attemptIds: ['a1'],
      otherAttemptIds: ['x1'],
    });
    await reload();
    expect(firestore.reads).toEqual([
      { path: attemptsPath, after: 1_500 },
      { path: notesPath, after: 0 },
    ]);
    expect(firestore.counts).toEqual([attemptsPath]);
    expect(localAttemptIds()).toEqual(['a1']);
    expect(firestore.writes).toEqual([]);
  });

  describe('with server records listed as unreadable', () => {
    const idReads = () => firestore.reads.filter((read) => read.ids);
    const unreadable = (id: string, syncedAt: number) =>
      firestore.server.set(`${attemptsPath}/${id}`, {
        ...savedAttempt(id),
        subject: 'future',
        syncedAt: firestore.stamp(syncedAt),
      });

    it('reads them again by id when unchecked, and takes the ones this version reads', async () => {
      onServer('a1', 1_000);
      // A page open since before the version that wrote x1 could not read it, and listed it.
      onServer('x1', 1_500);
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1'], otherAttemptIds: ['x1'] });
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 2_000 },
        { path: attemptsPath, after: null, ids: ['x1'] },
        { path: notesPath, after: 0 },
      ]);
      expect(firestore.counts).toEqual([attemptsPath]);
      expect(localAttemptIds()).toEqual(['a1', 'x1']);
      expect(firestore.writes).toEqual([]);
      expect(savedCheckpoint().otherAttemptIds).toEqual([]);
      expect(sorted(savedCheckpoint().attemptIds)).toEqual(['a1', 'x1']);
    });

    it('reads the ones still unreadable again only once a day, or when a page lists a new one', async () => {
      onServer('a1', 1_000);
      unreadable('x1', 1_500);
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1'], otherAttemptIds: ['x1'] });
      await load();
      expect(idReads()).toEqual([{ path: attemptsPath, after: null, ids: ['x1'] }]);
      expect(localAttemptIds()).toEqual(['a1']);
      expect(savedCheckpoint().otherAttemptIds).toEqual(['x1']);
      expect(savedCheckpoint().otherCheckedAt).toBeGreaterThan(0);
      await reload();
      expect(idReads()).toEqual([]);
      vi.setSystemTime(Date.now() + OTHER_ATTEMPTS_RECHECK_MS);
      await reload();
      expect(idReads()).toEqual([{ path: attemptsPath, after: null, ids: ['x1'] }]);
      // This page's listener lists one it cannot read: the next load reads them at once.
      await elsewhere('added', `${attemptsPath}/x2`, {
        ...savedAttempt('x2'),
        subject: 'future',
        syncedAt: firestore.stamp(20_000),
      });
      expect(savedCheckpoint()).toMatchObject({
        otherAttemptIds: ['x1', 'x2'],
        otherCheckedAt: 0,
      });
      await reload();
      // x2 is in the since-read already.
      expect(idReads()).toEqual([{ path: attemptsPath, after: null, ids: ['x1'] }]);
      expect(firestore.writes).toEqual([]);
    });

    it('reads them 30 to a query, and no more than that', async () => {
      const others = Array.from({ length: 31 }, (_, index) => `x${index + 10}`);
      onServer('a1', 1_000);
      others.forEach((id, index) => unreadable(id, 1_100 + index));
      onThisDevice(['a1']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1'], otherAttemptIds: others });
      await load();
      expect(firestore.reads).toEqual([
        { path: attemptsPath, after: 2_000 },
        { path: attemptsPath, after: null, ids: others.slice(0, 30) },
        { path: attemptsPath, after: null, ids: others.slice(30) },
        { path: notesPath, after: 0 },
      ]);
      expect(sorted(savedCheckpoint().otherAttemptIds)).toEqual(sorted(others));
    });
  });

  it('decodes each record of a full read once', async () => {
    onServer('a1', 1_000);
    onServer('a2', 2_000);
    onServer('a3', 3_000);
    noteOnServer(NOTE, V1, 1_500);
    noteOnServer(OTHER_NOTE, V1, 2_500);
    await load();
    // The latest records are in the listeners' windows too, which decode them on their own.
    expect(firestore.decoded.get(`${attemptsPath}/a1`)).toBe(1);
    expect(firestore.decoded.get(`${attemptsPath}/a2`)).toBe(1);
    expect(firestore.decoded.get(`${notesPath}/${NOTE}`)).toBe(1);
  });

  describe('when confirmed attempts are missing from the server and no log lists them', () => {
    const ids = (count: number) =>
      Array.from(
        { length: count },
        (_, index) => `a${String(index + 1).padStart(2, '0')}`,
      );

    // However many are missing, and whatever share of the whole.
    it.each([
      [1, 3],
      [21, 84],
      [22, 24],
    ])(
      'takes %i of %i for lost server data: removes none here and sends them again',
      async (missing, total) => {
        const all = ids(total);
        all.slice(missing).forEach((id, index) => onServer(id, 1_000 + index));
        onThisDevice(all);
        checkpoint({ attemptsAfter: 1_000, attemptIds: all });
        await load();
        expect(firestore.reads).toContainEqual({ path: attemptsPath, after: null });
        expect(localAttemptIds()).toEqual(all);
        expect(sorted(firestore.writes)).toEqual(
          all.slice(0, missing).map((id) => `${attemptsPath}/${id}`),
        );
        expect(sorted(savedCheckpoint().attemptIds)).toEqual(all);
        expect(savedCheckpoint().deletedAttemptIds).toEqual([]);
      },
    );

    it('still removes the ones the log lists among them', async () => {
      const all = ids(24);
      onServer('a01', 1_000);
      onServer('a02', 2_000);
      onThisDevice(all);
      checkpoint({ attemptsAfter: 2_000, attemptIds: all });
      logged('a03', 'a04');
      await load();
      expect(localAttemptIds()).toEqual(all.filter((id) => id !== 'a03' && id !== 'a04'));
      expect(sorted(firestore.writes)).toEqual(
        all.slice(4).map((id) => `${attemptsPath}/${id}`),
      );
      expect(savedCheckpoint().deletedAttemptIds).toEqual(['a03', 'a04']);
    });
  });

  describe('with two pages of this browser open', () => {
    beforeEach(() => {
      // Deletions go unlogged, as before the rules for the log: the browser's own news is
      // all page A has.
      firestore.logRules = false;
      // a1 is older than what either page's listener reads from.
      onServer('a1', 1_000);
      onServer('a2', 2_000);
      onThisDevice(['a1', 'a2']);
      checkpoint({ attemptsAfter: 2_000, attemptIds: ['a1', 'a2'] });
    });

    async function deleteInPageB() {
      await openTabs('A', 'B');
      await act(async () => tabs.B.dispatch({ type: 'delete-attempt', attemptId: 'a1' }));
      await pass(500);
      expect(firestore.server.has(`${attemptsPath}/a1`)).toBe(false);
      expect(savedCheckpoint()).toMatchObject({
        attemptIds: ['a2'],
        deletedAttemptIds: ['a1'],
      });
      // Page A's listener reads from a2 on, so it never hears of the deletion.
      expect(tabAttemptIds('A')).toEqual(['a1', 'a2']);
    }

    it('drops an attempt deleted in one page from the other when told', async () => {
      await deleteInPageB();
      // The browser tells every other page that the checkpoint changed.
      await act(async () =>
        window.dispatchEvent(new StorageEvent('storage', { key: CHECKPOINT_KEY })),
      );
      expect(tabAttemptIds('A')).toEqual(['a2']);
    });

    it('drops it at the next load after the other page saved it back, and never sends it', async () => {
      await deleteInPageB();
      // Page A missed the news and saves its data, a1 included, over page B's.
      await act(async () =>
        tabs.A.dispatch({
          type: 'save-answer',
          questionId: 'law-114-03',
          selected: 1,
          correct: true,
          answeredAt: '2026-11-13T00:00:00.000Z',
        }),
      );
      await pass(100);
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
      expect(saved.attempts.map((attempt) => attempt.id)).toContain('a1');
      await reload();
      expect(localAttemptIds()).toEqual(['a2']);
      expect(firestore.writes).toEqual([]);
      expect(firestore.server.has(`${attemptsPath}/a1`)).toBe(false);
    });

    it('drops it from the other page through the log once the rules cover it', async () => {
      firestore.logRules = true;
      await openTabs('A', 'B');
      await act(async () => tabs.B.dispatch({ type: 'delete-attempt', attemptId: 'a1' }));
      await pass(500);
      expect(serverLog()).toEqual(['a1']);
      // No storage event: page A's log listener heard it from the server.
      expect(tabAttemptIds('A')).toEqual(['a2']);
      expect(firestore.writes).toEqual([]);
    });
  });
});
