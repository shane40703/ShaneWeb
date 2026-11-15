import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferPushReceipt, duePushReceipts, getPushReceipt, hurryTransientPushReceipts, parsePushMessage, pendingPushReceipts, pushBrowserId, pushRetryDelay, pushTestMode, PUSH_RECEIPT_PREFIX, savePushReceipt, type PushMessage } from './push-messages';

const message: PushMessage = { id: 'notice', status: 'test', message: '公告內容', expiresAt: Date.now() + 60_000 };
beforeEach(() => { localStorage.clear(); });
describe('push message validation and local journal', () => {
  it('only accepts nonempty text, valid stages and a future Firestore timestamp', () => {
    const data = { ...message, expiresAt: { toMillis: () => 200 } };
    expect(parsePushMessage('id', data, 100)?.message).toBe('公告內容');
    for (const change of [{ status: undefined }, { status: 'LIVE' }, { message: '  ' }, { message: 'x'.repeat(2001) }, { expiresAt: '2099-01-01' }]) {
      expect(parsePushMessage('id', { ...data, ...change }, 100)).toBeNull();
    }
    expect(parsePushMessage('id', data, 200)).toBeNull();
  });
  it('remembers only the explicit test URL choices', () => {
    expect(pushTestMode('')).toBe(false);
    expect(pushTestMode('?push_test=1')).toBe(true);
    expect(pushTestMode('?push_test=wrong')).toBe(true);
    expect(pushTestMode('?push_test=0')).toBe(false);
    expect(pushTestMode('')).toBe(false);
  });
  it('keeps stage read states separate and never persists message text', () => {
    savePushReceipt(message, true);
    expect(getPushReceipt(message)?.read).toBe(true);
    expect(getPushReceipt({ ...message, status: 'live' })).toBeNull();
    savePushReceipt(message, false);
    expect(getPushReceipt(message)).toMatchObject({ read: true, message: '' });
    expect(pendingPushReceipts()).toHaveLength(1);
  });
  it('stops retrying expired receipts but retains read state for extended documents', () => {
    savePushReceipt(message, true);
    expect(pendingPushReceipts(message.expiresAt + 1)).toEqual([]);
    expect(getPushReceipt(message)).toMatchObject({ read: true, pending: false });
  });
  it('reuses one random browser id without requiring a user account', () => {
    expect(pushBrowserId()).toBe(pushBrowserId());
    expect(pushBrowserId()).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('continues in memory when persistence is blocked', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const isolated = { ...message, id: 'blocked' };
    savePushReceipt(isolated, true);
    expect(getPushReceipt(isolated)?.read).toBe(true);
    set.mockRestore();
    // Saved again with storage back, it leaves the in-memory fallback for the next test's clear().
    savePushReceipt(isolated, true, false);
  });
});
describe('receipt backoff', () => {
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const now = Date.now();
  const notice: PushMessage = { ...message, id: 'backoff', status: 'live', expiresAt: now + 30 * 24 * HOUR };
  it('doubles from 1 h up to 24 h when retrying cannot help, otherwise from 1 min up to 1 h', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((failures) => pushRetryDelay('permission-denied', failures) / HOUR)).toEqual([1, 2, 4, 8, 16, 24, 24]);
    for (const code of ['invalid-argument', 'not-found', 'unauthenticated']) expect(pushRetryDelay(code, 1)).toBe(HOUR);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((failures) => pushRetryDelay('unavailable', failures) / MINUTE)).toEqual([1, 2, 4, 8, 16, 32, 60, 60]);
    // A transaction that lost to other visitors' commits too often ends with either of these.
    for (const code of ['aborted', 'failed-precondition']) expect(pushRetryDelay(code, 1)).toBe(MINUTE);
    for (const code of ['', 'resource-exhausted', 'deadline-exceeded', 'internal']) expect(pushRetryDelay(code, 1)).toBe(MINUTE);
  });
  it('keeps a failed receipt pending, but not due before its retry time', () => {
    savePushReceipt(notice, false);
    expect(duePushReceipts(now)).toHaveLength(1);
    expect(deferPushReceipt(notice, 'permission-denied', now)).toMatchObject({ pending: true, failures: 1, retryAt: now + HOUR, network: false });
    expect(pendingPushReceipts(now)).toHaveLength(1);
    expect(duePushReceipts(now + HOUR - 1)).toEqual([]);
    expect(duePushReceipts(now + HOUR)).toHaveLength(1);
    expect(deferPushReceipt(notice, 'permission-denied', now + HOUR)).toMatchObject({ failures: 2, retryAt: now + 3 * HOUR });
    expect(localStorage.getItem(PUSH_RECEIPT_PREFIX + 'live:backoff')).not.toContain(notice.message);
  });
  it('keeps the wait through a new read, and ends it on success or expiry', () => {
    savePushReceipt(notice, false);
    deferPushReceipt(notice, 'unavailable', now);
    expect(savePushReceipt(notice, true)).toMatchObject({ read: true, pending: true, failures: 1, retryAt: now + MINUTE });
    expect(duePushReceipts(now)).toEqual([]);
    // Reported, with a read from another tab still to send: due at once, counting from zero.
    expect(savePushReceipt(notice, true, true, false)).toEqual({ ...notice, message: '', read: true, pending: true });
    expect(duePushReceipts(now)).toHaveLength(1);
    deferPushReceipt(notice, 'unavailable', now);
    expect(savePushReceipt(notice, true, false)).toEqual({ ...notice, message: '', read: true, pending: false });
    deferPushReceipt(notice, 'unavailable', now);
    expect(getPushReceipt(notice)).not.toHaveProperty('failures');
    savePushReceipt({ ...notice, id: 'expiring', expiresAt: now + MINUTE }, false);
    deferPushReceipt({ ...notice, id: 'expiring' }, 'permission-denied', now);
    expect(duePushReceipts(now + MINUTE)).toEqual([]);
    expect(getPushReceipt({ ...notice, id: 'expiring' })).toEqual({ ...notice, id: 'expiring', message: '', expiresAt: now + MINUTE, read: false, pending: false });
  });
  it('accepts receipts saved before the backoff existed, and ignores damaged retry fields', () => {
    const legacy = { id: 'legacy', status: 'live', message: '', expiresAt: now + HOUR, read: false, pending: true } as const;
    localStorage.setItem(PUSH_RECEIPT_PREFIX + 'live:legacy', JSON.stringify(legacy));
    expect(getPushReceipt(legacy)).toEqual(legacy);
    expect(duePushReceipts(now)).toEqual([legacy]);
    expect(deferPushReceipt(legacy, 'unavailable', now)).toEqual({ ...legacy, failures: 1, retryAt: now + MINUTE, network: true });
    localStorage.setItem(PUSH_RECEIPT_PREFIX + 'live:legacy', JSON.stringify({ ...legacy, failures: 'x', retryAt: 'later' }));
    expect(duePushReceipts(now)).toHaveLength(1);
    expect(deferPushReceipt(legacy, 'permission-denied', now)).toMatchObject({ failures: 1, retryAt: now + HOUR });
  });
  it('on going online makes only lost-connection waits due at once, and keeps the count for the next failure', () => {
    const flaky = { ...notice, id: 'flaky' };
    const denied = { ...notice, id: 'denied' };
    savePushReceipt(flaky, false);
    savePushReceipt(denied, false);
    for (let i = 0; i < 3; i++) deferPushReceipt(flaky, 'unavailable', now);
    deferPushReceipt(denied, 'permission-denied', now);
    // Other visitors' commits on the shared stats, or the day's quota: reconnecting fixes neither.
    const contended = { ...notice, id: 'contended' };
    const quota = { ...notice, id: 'quota' };
    savePushReceipt(contended, false);
    savePushReceipt(quota, false);
    deferPushReceipt(contended, 'failed-precondition', now);
    deferPushReceipt(contended, 'aborted', now);
    deferPushReceipt(quota, 'resource-exhausted', now);
    deferPushReceipt(quota, 'resource-exhausted', now);
    // Deferred before the kind of failure was kept: it waits out its time.
    const older = { id: 'older', status: 'live', message: '', expiresAt: now + HOUR, read: false, pending: true, failures: 2, retryAt: now + 2 * MINUTE } as const;
    localStorage.setItem(PUSH_RECEIPT_PREFIX + 'live:older', JSON.stringify(older));
    // A read after the failure keeps its kind along with the wait.
    expect(savePushReceipt(flaky, true)).toMatchObject({ failures: 3, retryAt: now + 4 * MINUTE, network: true });
    expect(duePushReceipts(now + MINUTE)).toEqual([]);
    hurryTransientPushReceipts(now + MINUTE);
    expect(duePushReceipts(now + MINUTE).map((receipt) => receipt.id)).toEqual(['flaky']);
    expect(getPushReceipt(flaky)).toEqual({ ...flaky, message: '', read: true, pending: true, failures: 3, retryAt: now + MINUTE, network: true });
    expect(getPushReceipt(denied)).toMatchObject({ failures: 1, retryAt: now + HOUR, network: false });
    expect(getPushReceipt(contended)).toMatchObject({ failures: 2, retryAt: now + 2 * MINUTE, network: false });
    expect(getPushReceipt(quota)).toMatchObject({ failures: 2, retryAt: now + 2 * MINUTE, network: false });
    expect(getPushReceipt(older)).toEqual(older);
    // Failing again right after reconnecting still waits longer than before.
    expect(deferPushReceipt(flaky, 'unavailable', now + MINUTE)).toMatchObject({ failures: 4, retryAt: now + 9 * MINUTE });
    // A success ends the wait and its kind with it.
    expect(savePushReceipt(flaky, true, false)).toEqual({ ...flaky, message: '', read: true, pending: false });
  });
});
