import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushMessages } from './push-messages';
import { type PushMessage, getPushReceipt, savePushReceipt, PUSH_MODE_KEY } from '@/lib/push-messages';
import type { PushTransport } from '@/lib/push-messages-firestore';
import { useQuizBodyShortcuts } from '@/features/practice/quiz-keyboard';

vi.mock('@/lib/firebase-client', () => ({ getFirebaseServices: () => null }));
vi.mock('@/lib/analytics', () => ({ trackPush: vi.fn() }));
import { trackPush } from '@/lib/analytics';

let emit: (messages: PushMessage[]) => void;
let transport: PushTransport;
let message: PushMessage;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  message = { id: crypto.randomUUID(), status: 'live', message: '新的網站公告', expiresAt: Date.now() + 60_000 };
  const seen = new Map<string, boolean>();
  transport = {
    subscribe: vi.fn((_test, next) => { emit = next; return vi.fn(); }),
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
  it('handles cross-tab reads and retries offline acknowledgements', async () => {
    vi.mocked(transport.record).mockRejectedValueOnce(new Error('offline'));
    render(<PushMessages transport={transport} />);
    act(() => emit([message]));
    await screen.findByText(message.message);
    await waitFor(() => expect(transport.record).toHaveBeenCalled());
    savePushReceipt(message, true);
    fireEvent(window, new Event('storage'));
    expect(screen.queryByText(message.message)).not.toBeInTheDocument();
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(trackPush).toHaveBeenCalledWith('push_read', 'live'));
  });
  it('honors another tab disabling test mode instead of replaying its old URL choice', () => {
    render(<PushMessages search="push_test=1" transport={transport} />);
    localStorage.setItem(PUSH_MODE_KEY, '0');
    fireEvent(window, new Event('storage'));
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
