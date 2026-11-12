import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPushReceipt, parsePushMessage, pendingPushReceipts, pushBrowserId, pushTestMode, savePushReceipt, type PushMessage } from './push-messages';

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
  });
});
