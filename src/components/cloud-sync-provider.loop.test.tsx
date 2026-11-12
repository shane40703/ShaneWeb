import { act, cleanup, render } from '@testing-library/react';
import { useEffect, type Dispatch } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncProvider } from '@/components/cloud-sync-provider';
import type { QuizAttempt } from '@/lib/types';
import type { AppAction } from '@/state/app-reducer';
import { AppStateProvider, useAppState } from '@/state/app-state';

type Outcome = { kind: 'ack' | 'deny'; delay: number; code?: string } | { kind: 'never' };

// A stand-in for Firestore 12 that behaves like the real SDK where it matters here: every
// setDoc with serverTimestamp() shows up at once as a pending local change (one per local
// write millisecond), the server answers later or never, and a refused write is rolled
// back with a non-pending snapshot.
const firestore = vi.hoisted(() => ({
  outcome: (() => ({ kind: 'ack', delay: 150 })) as (path: string) => Outcome,
  writes: new Map<string, number>(),
  deletes: new Map<string, number>(),
  server: new Map<string, Record<string, unknown>>(),
  local: new Set<string>(),
  lastLocalWrite: new Map<string, number>(),
  listeners: new Map<string, (snapshot: unknown) => void>(),
}));

vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  getFirebaseServices: () => ({ db: {}, auth: {} }),
}));
vi.mock('@/components/progress-sync-bridge', () => ({ ProgressSyncBridge: () => null }));
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
  const ref = (path: string) => ({ path, id: path.split('/').pop() });
  // Firestore hands map fields back in its own order, not in the order they were written.
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, item]) => [key, reorder(item)]),
          )
        : value;
  const emit = (
    path: string,
    type: 'added' | 'modified' | 'removed',
    data: Record<string, unknown>,
    pending: boolean,
  ) =>
    // The SDK raises listener events from a later task.
    setTimeout(() =>
      firestore.listeners.get(parent(path))?.({
        docChanges: () => [
          {
            type,
            doc: {
              id: path.split('/').pop(),
              data: () => reorder(data),
              metadata: { hasPendingWrites: pending },
            },
          },
        ],
        metadata: { fromCache: false, hasPendingWrites: pending },
      }),
    );
  return {
    collection: (_db: unknown, ...path: string[]) => ref(path.join('/')),
    doc: (base: { path?: string }, ...path: string[]) =>
      ref([base.path, ...path].filter(Boolean).join('/')),
    serverTimestamp: () => 'SERVER_TIME',
    getDocs: async (target: { path: string }) => ({
      docs: [...firestore.server]
        .filter(([path]) => parent(path) === target.path)
        .map(([path, data]) => ({
          id: path.split('/').pop(),
          data: () => reorder(data),
        })),
    }),
    getDoc: async () => ({ exists: () => false, metadata: { fromCache: false } }),
    deleteDoc: (target: { path: string }) => {
      const { path } = target;
      firestore.deletes.set(path, (firestore.deletes.get(path) ?? 0) + 1);
      const outcome = firestore.outcome(path);
      if (outcome.kind === 'never') return new Promise(() => {});
      return new Promise((resolve, reject) =>
        setTimeout(
          () =>
            outcome.kind === 'ack'
              ? resolve(undefined)
              : reject(Object.assign(new Error('Refused.'), { code: outcome.code })),
          outcome.delay,
        ),
      );
    },
    runTransaction: async () => undefined,
    onSnapshot: (target: { path: string }, next: (snapshot: unknown) => void) => {
      firestore.listeners.set(target.path, next);
      setTimeout(() =>
        next({
          docChanges: () => [],
          exists: () => false,
          metadata: { fromCache: false, hasPendingWrites: false },
        }),
      );
      return () => firestore.listeners.delete(target.path);
    },
    setDoc: (target: { path: string }, data: Record<string, unknown>) => {
      const { path } = target;
      firestore.writes.set(path, (firestore.writes.get(path) ?? 0) + 1);
      // A pending serverTimestamp() reads back as null.
      const written = { ...data, syncedAt: null };
      const existed = firestore.local.has(path) || firestore.server.has(path);
      if (firestore.lastLocalWrite.get(path) !== Date.now()) {
        emit(path, existed ? 'modified' : 'added', written, true);
      }
      firestore.lastLocalWrite.set(path, Date.now());
      firestore.local.add(path);
      const outcome = firestore.outcome(path);
      if (outcome.kind === 'never') return new Promise(() => {});
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          if (outcome.kind === 'ack') {
            const accepted = { ...data, syncedAt: { seconds: 1 } };
            firestore.server.set(path, accepted);
            resolve(undefined);
            emit(path, 'modified', accepted, false);
            return;
          }
          reject(
            Object.assign(new Error('Refused.'), {
              code: outcome.code ?? 'permission-denied',
            }),
          );
          // The SDK rolls the refused write back to what the server has.
          const previous = firestore.server.get(path);
          if (previous) emit(path, 'modified', previous, false);
          else {
            firestore.local.delete(path);
            emit(path, 'removed', written, false);
          }
        }, outcome.delay),
      );
    },
  };
});

const controls: { dispatch: Dispatch<AppAction> } = { dispatch: () => {} };

function Controls() {
  const { dispatch } = useAppState();
  useEffect(() => {
    controls.dispatch = dispatch;
  }, [dispatch]);
  return null;
}

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

/** Lets fake time pass in small steps, so React renders and runs effects between them. */
async function pass(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 20) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
  }
}

async function signIn() {
  render(
    <AppStateProvider>
      <CloudSyncProvider>
        <Controls />
      </CloudSyncProvider>
    </AppStateProvider>,
  );
  await pass(200);
  expect(firestore.listeners.has('users/u1/attempts')).toBe(true);
  expect(firestore.listeners.has('users/u1/notes')).toBe(true);
}

const writesTo = (path: string) => firestore.writes.get(path) ?? 0;
const deletesOf = (path: string) => firestore.deletes.get(path) ?? 0;

/** A change another device made, as the server reports it. */
async function serverChange(path: string, data: Record<string, unknown>) {
  firestore.server.set(path, data);
  await act(async () =>
    firestore.listeners.get(path.split('/').slice(0, -1).join('/'))?.({
      docChanges: () => [
        {
          type: 'modified',
          doc: {
            id: path.split('/').pop(),
            data: () => data,
            metadata: { hasPendingWrites: false },
          },
        },
      ],
      metadata: { fromCache: false, hasPendingWrites: false },
    }),
  );
}

async function saveNote(questionId: string, content: string, updatedAt: string) {
  await act(async () =>
    controls.dispatch({ type: 'save-note', questionId, content, updatedAt }),
  );
}

async function save(attempt: QuizAttempt) {
  await act(async () =>
    controls.dispatch({
      type: 'save-attempt',
      attempt,
      results: { 'law-114-01': true },
    }),
  );
}

describe('CloudSyncProvider write echoes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    firestore.outcome = () => ({ kind: 'ack', delay: 150 });
    firestore.writes.clear();
    firestore.deletes.clear();
    firestore.server.clear();
    firestore.local.clear();
    firestore.lastLocalWrite.clear();
    firestore.listeners.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('writes a saved attempt once when the server accepts it', async () => {
    await signIn();
    await save(savedAttempt('attempt-a'));
    await pass(3_000);
    expect(writesTo('users/u1/attempts/attempt-a')).toBe(1);
    expect(firestore.server.has('users/u1/attempts/attempt-a')).toBe(true);
  });

  it('writes a saved attempt once while the server never answers', async () => {
    firestore.outcome = () => ({ kind: 'never' });
    await signIn();
    await save(savedAttempt('attempt-a'));
    await pass(5_000);
    expect(writesTo('users/u1/attempts/attempt-a')).toBe(1);
    // A later attempt is sent on its own; the first is still on its way.
    await save(savedAttempt('attempt-b'));
    await pass(2_000);
    expect(writesTo('users/u1/attempts/attempt-a')).toBe(1);
    expect(writesTo('users/u1/attempts/attempt-b')).toBe(1);
  });

  it('does not send an attempt the rules refused again on later changes', async () => {
    firestore.outcome = () => ({ kind: 'deny', delay: 150 });
    await signIn();
    await save(savedAttempt('attempt-a'));
    await pass(2_000);
    expect(writesTo('users/u1/attempts/attempt-a')).toBe(1);
    await save(savedAttempt('attempt-b'));
    await act(async () =>
      controls.dispatch({ type: 'toggle-difficult', questionId: 'law-114-01' }),
    );
    await pass(2_000);
    expect(writesTo('users/u1/attempts/attempt-a')).toBe(1);
    expect(writesTo('users/u1/attempts/attempt-b')).toBe(1);
    // Local work stays.
    expect(
      JSON.parse(localStorage.getItem('shaneweb:state') ?? '{"attempts":[]}').attempts,
    ).toHaveLength(2);
  });

  // The SDK only rejects a write it will not retry, whatever the code; the rollback to the
  // older server version must not make the newer one look unsent.
  it.each(['permission-denied', 'failed-precondition'])(
    'does not send a note version refused with %s again',
    async (code) => {
      firestore.server.set('users/u1/notes/law-114-01', {
        questionId: 'law-114-01',
        content: '舊筆記',
        updatedAt: '2026-11-01T00:00:00.000Z',
        syncedAt: { seconds: 1 },
      });
      firestore.outcome = (path) =>
        path.includes('/notes/')
          ? { kind: 'deny', delay: 150, code }
          : { kind: 'ack', delay: 150 };
      await signIn();
      await act(async () =>
        controls.dispatch({
          type: 'save-note',
          questionId: 'law-114-01',
          content: '新筆記',
          updatedAt: '2026-11-12T00:00:00.000Z',
        }),
      );
      await pass(3_000);
      expect(writesTo('users/u1/notes/law-114-01')).toBe(1);
      // A later edit is a new version and is tried again.
      await act(async () =>
        controls.dispatch({
          type: 'save-note',
          questionId: 'law-114-01',
          content: '再改一次',
          updatedAt: '2026-11-12T00:05:00.000Z',
        }),
      );
      await pass(1_000);
      expect(writesTo('users/u1/notes/law-114-01')).toBe(2);
    },
  );

  it('does not send a note version again while its write is on its way', async () => {
    firestore.outcome = () => ({ kind: 'never' });
    await signIn();
    await act(async () =>
      controls.dispatch({
        type: 'save-note',
        questionId: 'law-114-01',
        content: '筆記',
        updatedAt: '2026-11-12T00:00:00.000Z',
      }),
    );
    await pass(2_000);
    await act(async () =>
      controls.dispatch({
        type: 'save-note',
        questionId: 'law-114-02',
        content: '另一題',
        updatedAt: '2026-11-12T00:01:00.000Z',
      }),
    );
    await pass(2_000);
    expect(writesTo('users/u1/notes/law-114-01')).toBe(1);
    expect(writesTo('users/u1/notes/law-114-02')).toBe(1);
  });

  it('sends a newer note again when another device takes the server back to an older one', async () => {
    const note = 'users/u1/notes/law-114-01';
    await signIn();
    await saveNote('law-114-01', '桌機新版', '2026-11-12T10:30:00.000Z');
    await pass(1_000);
    expect(writesTo(note)).toBe(1);
    // The phone's offline edit from 10:00 reaches the server last.
    await serverChange(note, {
      questionId: 'law-114-01',
      content: '手機舊版',
      updatedAt: '2026-11-12T10:00:00.000Z',
      syncedAt: { seconds: 2 },
    });
    await pass(1_000);
    expect(writesTo(note)).toBe(2);
    expect(firestore.server.get(note)).toMatchObject({
      content: '桌機新版',
      updatedAt: '2026-11-12T10:30:00.000Z',
    });
    await pass(3_000);
    expect(writesTo(note)).toBe(2);
  });

  it('sends each attempt deletion once while others are still on their way', async () => {
    const path = (id: string) => `users/u1/attempts/${id}`;
    await signIn();
    for (const id of ['attempt-a', 'attempt-b', 'attempt-c']) {
      await save(savedAttempt(id));
    }
    await pass(1_000);
    const remove = (attemptId: string) =>
      act(async () => controls.dispatch({ type: 'delete-attempt', attemptId }));
    // Two deletions the server never answers, then one it accepts.
    firestore.outcome = () => ({ kind: 'never' });
    await remove('attempt-a');
    await pass(200);
    await remove('attempt-b');
    await pass(200);
    firestore.outcome = () => ({ kind: 'ack', delay: 150 });
    await remove('attempt-c');
    await pass(2_000);
    expect(deletesOf(path('attempt-a'))).toBe(1);
    expect(deletesOf(path('attempt-b'))).toBe(1);
    expect(deletesOf(path('attempt-c'))).toBe(1);
  });
});
