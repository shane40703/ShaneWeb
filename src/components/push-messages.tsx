import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PushMessageToast, PushTestBadge } from '@/components/push-message-toast';
import { getFirebaseServices } from '@/lib/firebase-client';
import { firestorePushTransport, type PushTransport } from '@/lib/push-messages-firestore';
import { getPushReceipt, pendingPushReceipts, pushBrowserId, pushKey, pushTestMode, savePushReceipt, type PushMessage } from '@/lib/push-messages';
import { trackPush } from '@/lib/analytics';

export function PushMessages({ search = '', transport }: { search?: string; transport?: PushTransport }) {
  const [test, setTest] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [now, setNow] = useState(0);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [, redraw] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const service = useMemo(() => {
    if (transport) return transport;
    if (typeof window === 'undefined') return null;
    const firebase = getFirebaseServices();
    return firebase ? firestorePushTransport(firebase.db) : null;
  }, [transport]);

  // Browser-owned URL/storage state cannot be read during server rendering.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTest(pushTestMode(search)); }, [search]);
  const flush = useCallback(async () => {
    if (!service || inFlight.current) return;
    inFlight.current = true;
    try {
      for (const receipt of pendingPushReceipts()) {
        try {
          const result = await service.record(receipt, pushBrowserId());
          // Another tab/click may have marked read while delivery was in flight.
          const latest = getPushReceipt(receipt);
          savePushReceipt(receipt, result.alreadyRead || latest?.read === true,
            latest?.read === true && !receipt.read && !result.alreadyRead);
          if (result.delivered) trackPush('push_delivered', receipt.status);
          if (result.read) trackPush('push_read', receipt.status);
        } catch {
          // One withdrawn/denied message must not block all other pending receipts.
        }
      }
    } catch {
      // Keep the journal. Offline/permission/index failures never interrupt writing answers.
    } finally {
      inFlight.current = false;
      if (mounted.current) redraw((value) => value + 1);
    }
  }, [service]);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      setVisible(document.visibilityState !== 'hidden');
      setNow(Date.now());
      setTest(pushTestMode(''));
      redraw((value) => value + 1);
      void flush();
    };
    const reconnect = () => { refresh(); setRetry((value) => value + 1); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('storage', refresh);
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [flush]);
  useEffect(() => {
    if (test === null || !service) return;
    // Invalidate results belonging to a previous external subscription immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setError(false);
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = service.subscribe(test, (next) => {
      // Counter-only snapshots must not re-announce the same text to screen readers.
      setMessages((current) => {
        const stable = next.map((item) => current.find((old) => pushKey(old) === pushKey(item)
          && old.message === item.message && old.expiresAt === item.expiresAt) ?? item);
        return stable.length === current.length && stable.every((item, index) => item === current[index]) ? current : stable;
      });
      setNow(Date.now());
      setError(false);
    }, () => {
      setMessages([]);
      setError(true);
      retryTimer = setTimeout(() => setRetry((value) => value + 1), 30_000);
    });
    return () => { unsubscribe(); clearTimeout(retryTimer); };
  }, [service, test, retry]);

  const message = visible ? messages.find((item) => item.expiresAt > now
    && (item.status === 'live' || (test && item.status === 'test')) && !getPushReceipt(item)?.read) : undefined;
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, message.expiresAt - Date.now())));
    return () => clearTimeout(timer);
  }, [message]);
  const delivered = useCallback(() => {
    if (!message || message.expiresAt <= Date.now() || document.visibilityState === 'hidden') return;
    const receipt = getPushReceipt(message);
    if (!receipt) savePushReceipt(message, false);
    if (!receipt || receipt.pending) void flush();
  }, [message, flush]);
  const read = () => {
    if (!message) return;
    savePushReceipt(message, true);
    redraw((value) => value + 1);
    void flush();
  };
  return <>
    {test ? <PushTestBadge error={error || !service} /> : null}
    {message ? <PushMessageToast key={pushKey(message)} message={message} onDelivered={delivered} onRead={read} /> : null}
  </>;
}
