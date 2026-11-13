import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import type { PushReceipt } from './push-messages';

const store = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock('firebase/firestore', () => ({
  doc: (base: { path?: string }, ...parts: string[]) => ({ path: [base.path, ...parts].filter(Boolean).join('/') }),
  runTransaction: async (_db: unknown, work: (transaction: unknown) => Promise<unknown>) => work({
    get: async (ref: { path: string }) => {
      const data = store.get(ref.path);
      return { id: ref.path.split('/').pop(), exists: () => data !== undefined, data: () => data };
    },
    set: (ref: { path: string }, data: Record<string, unknown>) => store.set(ref.path, data),
  }),
  collection: vi.fn(), onSnapshot: vi.fn(), orderBy: vi.fn(), query: vi.fn(), where: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

import { firestorePushTransport } from './push-messages-firestore';

const receipt: PushReceipt = { id: 'notice', status: 'test', message: '', expiresAt: Date.now() + 60_000, read: false, pending: true };
const browserId = '12345678-1234-1234-1234-123456789abc';
const parentPath = 'pushMessages/notice';
const statsPath = `${parentPath}/stats/test`;
const targetPath = `${parentPath}/receipts/test_${browserId}`;

beforeEach(() => {
  store.clear();
  store.set(parentPath, { status: 'test', message: '公告', expiresAt: { toMillis: () => Date.now() + 60_000 }, testDelivered: 4 });
});

describe('announcement counters', () => {
  it('records delivery and read separately without modifying the subscribed announcement', async () => {
    const transport = firestorePushTransport({} as Firestore);
    const original = store.get(parentPath);
    expect(await transport.record(receipt, browserId)).toEqual({ delivered: true, read: false, alreadyRead: false });
    expect(store.get(parentPath)).toBe(original);
    expect(store.get(statsPath)).toMatchObject({ delivered: 1, read: 0 });
    expect(store.get(targetPath)).toMatchObject({ delivered: true, read: false });
    expect(await transport.record({ ...receipt, read: true }, browserId)).toEqual({ delivered: false, read: true, alreadyRead: true });
    expect(store.get(statsPath)).toMatchObject({ delivered: 1, read: 1 });
    expect(store.get(parentPath)).toBe(original);
    expect(await transport.record({ ...receipt, read: true }, browserId)).toEqual({ delivered: false, read: false, alreadyRead: true });
    expect(store.get(statsPath)).toMatchObject({ delivered: 1, read: 1 });
  });

  it('does not update statistics for withdrawn or expired announcements', async () => {
    store.set(parentPath, { status: 'live', message: '公告', expiresAt: { toMillis: () => Date.now() + 60_000 } });
    await firestorePushTransport({} as Firestore).record(receipt, browserId);
    expect(store.has(statsPath)).toBe(false);
    store.set(parentPath, { status: 'test', message: '公告', expiresAt: { toMillis: () => Date.now() - 1 } });
    await firestorePushTransport({} as Firestore).record(receipt, browserId);
    expect(store.has(statsPath)).toBe(false);
  });
});
