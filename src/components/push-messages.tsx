import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PushMessageToast, PushTestBadge } from '@/components/push-message-toast';
import { getFirebaseServices } from '@/lib/firebase-client';
import { firestoreErrorCode } from '@/lib/firestore-error-code';
import { listenRetryDelay } from '@/lib/listen-retry';
import { firestorePushTransport, type PushTransport } from '@/lib/push-messages-firestore';
import { deferPushReceipt, duePushReceipts, getPushReceipt, hurryTransientPushReceipts, PUSH_KEY_PREFIX, pushBrowserId, pushKey, pushTestMode, savePushReceipt, type PushMessage } from '@/lib/push-messages';
import { trackPush } from '@/lib/analytics';

/** Held by the one tab of this browser that is reporting receipts. */
const FLUSH_LOCK = 'shaneweb:push-flush';
// Each new subscription is a new target, read in full: wait 30 s, doubling up to 30 min.
const RESUBSCRIBE = { base: 30_000, max: 30 * 60_000 };

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
  // Failed subscriptions in a row, kept across re-subscribes; and whether the current one failed.
  const listenFailures = useRef(0);
  const listenFailed = useRef(false);
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
    // A receipt reaches Firestore only while it is pending and its retryAt has passed. Offline, a
    // try could only fail and lengthen the wait; going online reports at once instead.
    if (!service || inFlight.current || navigator.onLine === false || !duePushReceipts().length) return;
    inFlight.current = true;
    const report = async () => {
      // Read again under the lock: the tab that held it last may have reported these.
      for (const receipt of duePushReceipts()) {
        if (navigator.onLine === false) break;
        try {
          const result = await service.record(receipt, pushBrowserId());
          // Another tab/click may have marked read while delivery was in flight.
          const latest = getPushReceipt(receipt);
          savePushReceipt(receipt, result.alreadyRead || latest?.read === true,
            latest?.read === true && !receipt.read && !result.alreadyRead, false);
          if (result.delivered) trackPush('push_delivered', receipt.status);
          if (result.read) trackPush('push_read', receipt.status);
        } catch (reason) {
          // One withdrawn/denied message must not block the others; it waits out its own backoff.
          deferPushReceipt(receipt, firestoreErrorCode(reason));
        }
      }
    };
    try {
      const locks: LockManager | undefined = navigator.locks;
      let entered = false;
      try {
        // The tabs of one browser share these receipts: while one reports, the others skip.
        if (locks) await locks.request(FLUSH_LOCK, { ifAvailable: true }, (lock) => { entered = true; return lock ? report() : undefined; });
      } catch (reason) {
        // Opaque-origin or sandboxed frames and blocked site data can refuse every lock request.
        // Once the callback has run, though, another tab is reporting or this one already has.
        if (entered) throw reason;
      }
      if (!entered) await report();
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
    };
    // The tick is also what retries a receipt once its backoff is over.
    const refreshAndFlush = () => { refresh(); void flush(); };
    // Other tabs save every answer here. Only announcement keys and clear() (no key) matter, and
    // only for display: reporting from here made each write in one tab report in all the others.
    const storage = ({ key }: StorageEvent) => { if (key === null || key?.startsWith(PUSH_KEY_PREFIX)) refresh(); };
    const visibility = () => { if (document.visibilityState === 'hidden') refresh(); else refreshAndFlush(); };
    // A healthy listener reconnects by itself; a new subscription would be read in full again.
    const online = () => {
      hurryTransientPushReceipts();
      refreshAndFlush();
      if (listenFailed.current) setRetry((value) => value + 1);
    };
    refreshAndFlush();
    const timer = window.setInterval(refreshAndFlush, 30_000);
    window.addEventListener('storage', storage);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('storage', storage);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [flush]);
  useEffect(() => {
    if (test === null || !service) return;
    // Invalidate results belonging to a previous external subscription immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setError(false);
    listenFailed.current = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = service.subscribe(test, (next, fromCache) => {
      // Only the server's answer shows the query works: a cached one can come before the same error.
      if (!fromCache) listenFailures.current = 0;
      // Counter-only snapshots must not re-announce the same text to screen readers.
      setMessages((current) => {
        const stable = next.map((item) => current.find((old) => pushKey(old) === pushKey(item)
          && old.message === item.message && old.expiresAt === item.expiresAt) ?? item);
        return stable.length === current.length && stable.every((item, index) => item === current[index]) ? current : stable;
      });
      setNow(Date.now());
      setError(false);
    }, (reason) => {
      setMessages([]);
      setError(true);
      listenFailed.current = true;
      // The query is public: a denial means rules not deployed, failed-precondition a missing
      // index. Every visitor's tab would retry those for nothing until a deploy; this one waits
      // for going online or a reload, as progress sync does.
      const wait = listenRetryDelay(reason, listenFailures.current, RESUBSCRIBE);
      if (wait === null) return;
      listenFailures.current++;
      retryTimer = setTimeout(() => setRetry((value) => value + 1), wait);
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
