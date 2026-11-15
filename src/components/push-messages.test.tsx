import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushMessages } from './push-messages';
import { type PushMessage, deferPushReceipt, getPushReceipt, savePushReceipt, pushKey, PUSH_MODE_KEY, PUSH_RECEIPT_PREFIX } from '@/lib/push-messages';
import type { PushTransport } from '@/lib/push-messages-firestore';
import { useQuizBodyShortcuts } from '@/features/practice/quiz-keyboard';

vi.mock('@/lib/firebase-client', () => ({ getFirebaseServices: () => null }));
vi.mock('@/lib/analytics', () => ({ trackPush: vi.fn() }));
import { trackPush } from '@/lib/analytics';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
let emit: (messages: PushMessage[], fromCache?: boolean) => void;
let fail: (reason?: unknown) => void;
let transport: PushTransport;
let message: PushMessage;
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  message = { id: crypto.randomUUID(), status: 'live', message: '新的網站公告', expiresAt: Date.now() + 60_000 };
  const seen = new Map<string, boolean>();
  transport = {
    subscribe: vi.fn((_test, next, error) => { emit = next; fail = error; return vi.fn(); }),
    record: vi.fn(async (receipt) => {
      const key = `${receipt.status}:${receipt.id}`;
      const delivered = !seen.has(key);
      const read = receipt.read && !seen.get(key);
      seen.set(key, receipt.read || !!seen.get(key));
      return { delivered, read, alreadyRead: !!seen.get(key) };
    }),
  };
});
describe('live push messages', () => {
  it('keeps body answer shortcuts working while the notice is open, but not inside its controls or a real dialog', async () => {
    const shortcut = vi.fn();
    function AnswerKeys() { useQuizBodyShortcuts(shortcut); return null; }
    const view = render(<><AnswerKeys /><PushMessages transport={transport} /></>);
    act(() => emit([message]));
    await screen.findByText(message.message);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(shortcut).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole('button', { name: '已讀' }), { key: 'Enter' });
    expect(shortcut).toHaveBeenCalledOnce();
    view.rerender(<><AnswerKeys /><PushMessages transport={transport} /><div role="dialog" aria-label="交卷確認" /></>);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(shortcut).toHaveBeenCalledOnce();
  });
  it('renders, counts once through repeated snapshots, and remembers explicit read on remount', async () => {
    const view = render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    expect(await screen.findByText(message.message)).toBeInTheDocument();
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_delivered', 'live'));
    act(() => emit([{ ...message }]));
    expect(vi.mocked(trackPush).mock.calls.filter(([event]) => event === 'push_delivered')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '已讀' }));
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_read', 'live'));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
    view.unmount();
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
  });
  it('separates test and live read state, and persists/shuts off the test query', async () => {
    const view = render(<PushMessages search="push_test=1" transport={transport} />);
    expect(screen.getByText('測試模式')).toBeInTheDocument();
    expect(transport.subscribe).toHaveBeenLastCalledWith(true, expect.any(Function), expect.any(Function));
    act(() => emit([{ ...message, status: 'test' }]));
    await screen.findByText(message.message);
    fireEvent.click(screen.getByRole('button', { name: '已讀' }));
    act(() => emit([message]));
    expect(await screen.findByText(message.message)).toBeInTheDocument();
    view.rerender(<PushMessages search="push_test=0" transport={transport} />);
    expect(screen.queryByText('測試模式')).not.toBeInTheDocument();
    expect(transport.subscribe).toHaveBeenLastCalledWith(false, expect.any(Function), expect.any(Function));
    act(() => emit([{ ...message, status: 'test' }]));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
  });
  it('retracts expired/deleted notices without marking read', async () => {
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    await screen.findByText(message.message);
    act(() => emit([]));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
    expect(getPushReceipt(message)?.read).not.toBe(true);
    act(() => emit([{ ...message, expiresAt: Date.now() - 1 }]));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
  });
  it('does not display/count background tabs until visible, or steal focus', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<><input aria-label="筆記" /><PushMessages transport={transport} /></>);
    const input = screen.getByRole('textbox');
    input.focus();
    act(() => emit([message]));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
    expect(transport.record).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByText(message.message)).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
    visibility.mockRestore();
  });
  it('handles cross-tab reads, and retries a failed acknowledgement once it is due', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    message = { ...message, expiresAt: Date.now() + DAY };
    vi.mocked(transport.record).mockRejectedValueOnce(new Error('offline'));
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    await screen.findByText(message.message);
    await waitFor(() => expect(getPushReceipt(message)?.failures).toBe(1));
    savePushReceipt(message, true);
    fireEvent(window, new StorageEvent('storage', { key: PUSH_RECEIPT_PREFIX + pushKey(message) }));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
    // Neither that read nor a tick reports it before its minute is up; the first tick after does.
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(transport.record).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(getPushReceipt(message)!.retryAt! - Date.now() + 30_000));
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_read', 'live'));
    expect(getPushReceipt(message)).toEqual({ ...message, message: '', read: true, pending: false });
  });
  it('honors another tab disabling test mode instead of replaying its old URL choice', () => {
    render(<PushMessages search="push_test=1" transport={transport} />);
    localStorage.setItem(PUSH_MODE_KEY, '0');
    fireEvent(window, new StorageEvent('storage', { key: PUSH_MODE_KEY }));
    expect(screen.queryByText('測試模式')).not.toBeInTheDocument();
    expect(localStorage.getItem(PUSH_MODE_KEY)).toBe('0');
  });
  it('expires on the client timer without waiting for another server snapshot', async () => {
    render(<PushMessages transport={transport} />);
    act(() => emit([{ ...message, expiresAt: Date.now() + 100 }]));
    await screen.findByText(message.message);
    await waitFor(() => expect(screen.queryByText(message.message)).not.toBeInTheDocument());
    expect(trackPush).not.toHaveBeenCalledWith('push_read', 'live');
  });
  it('does not count a queued notice before it is actually shown', async () => {
    render(<PushMessages transport={transport} />);
    const second = { ...message, id: 'queued-notice', message: '下一則公告' };
    act(() => emit([message, second]));
    await screen.findByText(message.message);
    expect(screen.queryByText(second.message)).not.toBeInTheDocument();
    expect(getPushReceipt(second)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '已讀' }));
    expect(await screen.findByText(second.message)).toBeInTheDocument();
  });
});
describe('Firestore traffic guards', () => {
  it('tries a denied receipt once, then waits out its backoff whatever happens meanwhile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    message = { ...message, expiresAt: Date.now() + 3 * DAY };
    vi.mocked(transport.record).mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    await screen.findByText(message.message);
    await waitFor(() => expect(getPushReceipt(message)).toMatchObject({ pending: true, failures: 1, network: false }));
    const retryAt = getPushReceipt(message)!.retryAt!;
    expect(retryAt - Date.now()).toBeGreaterThan(HOUR - MINUTE);
    // Interval ticks, other tabs, tab switches, reconnecting and even 已讀 all wait for retryAt.
    await act(() => vi.advanceTimersByTimeAsync(30 * MINUTE));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PUSH_RECEIPT_PREFIX + pushKey(message) }));
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
    });
    fireEvent.click(screen.getByRole('button', { name: '已讀' }));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(retryAt - Date.now() - MINUTE));
    expect(transport.record).toHaveBeenCalledOnce();
    expect(getPushReceipt(message)).toMatchObject({ read: true, pending: true, failures: 1, retryAt });
    // Due: a tick within the next minute reports delivery and read together; success ends the backoff.
    await act(() => vi.advanceTimersByTimeAsync(MINUTE));
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_read', 'live'));
    expect(trackPush).toHaveBeenCalledWith('push_delivered', 'live');
    expect(transport.record).toHaveBeenCalledTimes(2);
    expect(getPushReceipt(message)).toEqual({ ...message, message: '', read: true, pending: false });
  });
  it('tries nothing while offline, and on going online reports at once what a network failure deferred', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    message = { ...message, expiresAt: Date.now() + DAY };
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    await screen.findByText(message.message);
    // Shown in a tunnel: a try could only fail and lengthen the wait, so the ticks leave it alone.
    await act(() => vi.advanceTimersByTimeAsync(HOUR));
    expect(transport.record).not.toHaveBeenCalled();
    expect(getPushReceipt(message)).toEqual({ ...message, message: '', read: false, pending: true });
    // A flaky connection before the tunnel had failed it five times in a row: a 16-minute wait.
    for (let i = 0; i < 5; i++) deferPushReceipt(message, 'unavailable');
    fireEvent.click(screen.getByRole('button', { name: '已讀' }));
    await act(async () => {});
    expect(transport.record).not.toHaveBeenCalled();
    onLine.mockReturnValue(true);
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_read', 'live'));
    expect(trackPush).toHaveBeenCalledWith('push_delivered', 'live');
    expect(transport.record).toHaveBeenCalledOnce();
    expect(getPushReceipt(message)).toEqual({ ...message, message: '', read: true, pending: false });
  });
  it('ignores storage writes outside announcement keys, and only redraws for those', async () => {
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    await screen.findByText(message.message);
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_delivered', 'live'));
    await act(async () => {});
    // Another tab reads the notice, leaving a receipt due for reporting, and turns test mode on.
    savePushReceipt(message, true);
    localStorage.setItem(PUSH_MODE_KEY, '1');
    fireEvent(window, new StorageEvent('storage', { key: 'shaneweb:quiz-progress' }));
    fireEvent(window, new StorageEvent('storage', { key: 'shaneweb:practice-session' }));
    expect(screen.queryByText('測試模式')).not.toBeInTheDocument();
    fireEvent(window, new StorageEvent('storage', { key: PUSH_MODE_KEY }));
    expect(screen.getByText('測試模式')).toBeInTheDocument();
    await act(async () => {});
    expect(transport.record).toHaveBeenCalledOnce();
  });
  it('reports from one tab of the browser at a time, skipping while another holds the lock', async () => {
    let held = true;
    const request = vi.fn(async (_name: string, _options: LockOptions, granted: (lock: Lock | null) => unknown) =>
      granted(held ? null : ({ name: 'shaneweb:push-flush', mode: 'exclusive' } as Lock)));
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    try {
      render(<PushMessages transport={transport} />);
      act(() => emit([message]));
      await screen.findByText(message.message);
      await waitFor(() => expect(request).toHaveBeenCalledWith('shaneweb:push-flush', { ifAvailable: true }, expect.any(Function)));
      await act(async () => {});
      expect(transport.record).not.toHaveBeenCalled();
      expect(getPushReceipt(message)?.pending).toBe(true);
      held = false;
      fireEvent(window, new Event('online'));
      await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_delivered', 'live'));
      expect(transport.record).toHaveBeenCalledOnce();
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });
  it('reports without the lock where the browser refuses locks, but not once the lock callback has run', async () => {
    const lock = { name: 'shaneweb:push-flush', mode: 'exclusive' } as Lock;
    const request = vi.fn<(name: string, options: LockOptions, granted: (lock: Lock | null) => unknown) => Promise<unknown>>(async () => {
      throw new DOMException('Locks are not allowed in this frame', 'SecurityError');
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    try {
      render(<PushMessages transport={transport} />);
      act(() => emit([message]));
      await screen.findByText(message.message);
      await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_delivered', 'live'));
      expect(request).toHaveBeenCalled();
      expect(transport.record).toHaveBeenCalledOnce();
      await act(async () => {});
      // Rejected after the callback found another tab holding the lock: that tab reports.
      request.mockImplementation(async (_name, _options, granted) => { await granted(null); throw new DOMException('Aborted', 'AbortError'); });
      fireEvent.click(screen.getByRole('button', { name: '已讀' }));
      await act(async () => {});
      expect(transport.record).toHaveBeenCalledOnce();
      expect(getPushReceipt(message)).toMatchObject({ read: true, pending: true });
      // Rejected after reporting under the lock: nothing is sent a second time.
      request.mockImplementation(async (_name, _options, granted) => { await granted(lock); throw new DOMException('Aborted', 'AbortError'); });
      fireEvent(document, new Event('visibilitychange'));
      await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_read', 'live'));
      await act(async () => {});
      expect(transport.record).toHaveBeenCalledTimes(2);
      expect(getPushReceipt(message)).toMatchObject({ read: true, pending: false });
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });
  it('reports when the page becomes visible, not when it is hidden', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    render(<PushMessages transport={transport} />);
    // Due now, as when a backoff has just ended.
    savePushReceipt(message, false);
    visibility.mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => {});
    expect(transport.record).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(transport.record).toHaveBeenCalledOnce());
  });
  it('re-subscribes after errors with a doubling wait up to 30 minutes, reset by a server answer', () => {
    vi.useFakeTimers();
    render(<PushMessages transport={transport} />);
    const subscribe = vi.mocked(transport.subscribe);
    const failThenWait = (wait: number) => {
      const calls = subscribe.mock.calls.length;
      act(() => fail());
      act(() => { vi.advanceTimersByTime(wait - 1); });
      expect(subscribe).toHaveBeenCalledTimes(calls);
      act(() => { vi.advanceTimersByTime(1); });
      expect(subscribe).toHaveBeenCalledTimes(calls + 1);
    };
    expect(subscribe).toHaveBeenCalledOnce();
    for (const seconds of [30, 60, 120, 240, 480, 960, 1800, 1800]) failThenWait(seconds * 1000);
    // A cached answer can come before the same error again, so only the server's resets the wait.
    act(() => emit([], true));
    failThenWait(30 * MINUTE);
    act(() => emit([]));
    failThenWait(30_000);
    failThenWait(60_000);
  });
  it('stops re-subscribing after a missing index or undeployed rules until going online', () => {
    vi.useFakeTimers();
    render(<PushMessages transport={transport} />);
    const subscribe = vi.mocked(transport.subscribe);
    act(() => fail());
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(subscribe).toHaveBeenCalledTimes(2);
    for (const code of ['failed-precondition', 'permission-denied']) {
      const calls = subscribe.mock.calls.length;
      act(() => fail(Object.assign(new Error(code), { code })));
      act(() => { vi.advanceTimersByTime(24 * HOUR); });
      expect(subscribe).toHaveBeenCalledTimes(calls);
      fireEvent(window, new Event('online'));
      expect(subscribe).toHaveBeenCalledTimes(calls + 1);
    }
    // Those did not count: after the one passing failure before them, the next one waits 60 s.
    const calls = subscribe.mock.calls.length;
    act(() => fail({ code: 'unavailable' }));
    act(() => { vi.advanceTimersByTime(60_000 - 1); });
    expect(subscribe).toHaveBeenCalledTimes(calls);
    act(() => { vi.advanceTimersByTime(1); });
    expect(subscribe).toHaveBeenCalledTimes(calls + 1);
  });
  it('re-subscribes on going online only while the listener is failing', () => {
    render(<PushMessages transport={transport} />);
    const subscribe = vi.mocked(transport.subscribe);
    fireEvent(window, new Event('online'));
    act(() => emit([]));
    fireEvent(window, new Event('online'));
    expect(subscribe).toHaveBeenCalledOnce();
    act(() => fail());
    fireEvent(window, new Event('online'));
    expect(subscribe).toHaveBeenCalledTimes(2);
    fireEvent(window, new Event('online'));
    expect(subscribe).toHaveBeenCalledTimes(2);
  });
});
