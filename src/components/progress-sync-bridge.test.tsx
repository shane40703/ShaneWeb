import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProgressSyncBridge } from './progress-sync-bridge';
import { PROGRESS_JOURNAL_KEY } from '@/lib/progress-sync';

const mocks = vi.hoisted(() => ({
  receive: null as null | ((value: unknown) => void),
  fail: null as null | (() => void),
  unsubscribe: vi.fn(), set: vi.fn(), get: vi.fn(), listen: vi.fn(),
}));
vi.mock('@/lib/firebase-client', () => ({ getFirebaseServices: () => ({ db: {} }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (ref: { path: string }, id: string) => ({ path: `${ref.path}/${id}` }),
  serverTimestamp: () => 'SERVER_TIME',
  onSnapshot: (ref: unknown, options: unknown, receive: (value: unknown) => void, fail: () => void) => {
    mocks.listen(ref, options); mocks.receive = receive; mocks.fail = fail; return mocks.unsubscribe;
  },
  runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => callback({ get: mocks.get, set: mocks.set }),
}));
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); mocks.receive = null;
  mocks.get.mockResolvedValue({ exists: () => false });
});
afterEach(cleanup);
const draft = JSON.stringify({ version: 2, scopes: { 'paper:law:114': {
  'law-114-01': { selected: 2, eliminatedOptions: [1], elapsedSeconds: 20, startedAt: '2026-11-07', visitedAt: 123 },
} } });

it('waits for a server snapshot, writes private progress atomically, and stops when signed out', async () => {
  localStorage.setItem('shaneweb:quiz-progress', draft);
  const onStatus = vi.fn();
  const view = render(<ProgressSyncBridge userId="alice" onStatus={onStatus} />);
  expect(mocks.listen).toHaveBeenCalledWith({ path: 'users/alice/progress' }, { includeMetadataChanges: true });
  await act(async () => mocks.receive!({ metadata: { fromCache: true }, docs: [] }));
  expect(mocks.set).not.toHaveBeenCalled();
  await act(async () => mocks.receive!({ metadata: { fromCache: false, hasPendingWrites: true }, docs: [] }));
  expect(mocks.set).not.toHaveBeenCalled();
  await act(async () => mocks.receive!({ metadata: { fromCache: false, hasPendingWrites: false }, docs: [] }));
  await waitFor(() => expect(mocks.set).toHaveBeenCalledWith({ path: 'users/alice/progress/paper-law-114' }, expect.objectContaining({ version: 1, syncedAt: 'SERVER_TIME' })));
  expect(onStatus).toHaveBeenLastCalledWith({ status: 'synced', error: '' });
  view.rerender(<ProgressSyncBridge userId={null} onStatus={onStatus} />);
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  expect(onStatus).toHaveBeenLastCalledWith({ status: 'idle', error: '' });
});

it('does not overwrite either version when a newer transaction result conflicts with a local draft', async () => {
  localStorage.setItem('shaneweb:quiz-progress', draft);
  const newer = { version: 1, payload: null, updatedAt: Date.now() + 1000, writer: 'phone' };
  mocks.get.mockResolvedValue({ exists: () => true, data: () => newer });
  const onStatus = vi.fn();
  render(<ProgressSyncBridge userId="alice" onStatus={onStatus} />);
  await act(async () => mocks.receive!({ metadata: { fromCache: false, hasPendingWrites: false }, docs: [] }));
  expect(mocks.set).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem('shaneweb:quiz-progress')!).scopes['paper:law:114']).toBeDefined();
  expect(JSON.parse(localStorage.getItem(PROGRESS_JOURNAL_KEY + 'alice')!)['paper-law-114'].payload).not.toBeNull();
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'conflict' }));
});

it('reports denied rules without dropping the local draft and reconnects on online', async () => {
  localStorage.setItem('shaneweb:quiz-progress', draft);
  const onStatus = vi.fn();
  render(<ProgressSyncBridge userId="alice" onStatus={onStatus} />);
  await act(async () => mocks.fail!());
  expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error', error: expect.stringContaining('Firestore') }));
  expect(localStorage.getItem('shaneweb:quiz-progress')).toBe(draft);
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  expect(mocks.listen).toHaveBeenCalledTimes(2);
});

it('reconnects a failed quota-limited listener only after a pause', async () => {
  vi.useFakeTimers();
  try {
    const onStatus = vi.fn();
    render(<ProgressSyncBridge userId="alice" onStatus={onStatus} />);
    await act(async () => (mocks.fail as unknown as (cause: unknown) => void)({ code: 'resource-exhausted' }));
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ error: expect.stringContaining('用量') }));
    await act(async () => vi.advanceTimersByTimeAsync(299_999));
    expect(mocks.listen).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.listen).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
