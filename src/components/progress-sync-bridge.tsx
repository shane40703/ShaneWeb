import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase-client';
import { listenRetryDelay } from '@/lib/listen-retry';
import { compareProgress, parseProgressRecord } from '@/lib/progress-sync';
import { connectProgressSync, trackLocalProgress, type ProgressSyncState } from '@/lib/progress-sync-client';
import { PROGRESS_SYNC_NOW_EVENT } from '@/lib/progress-events';

// Each reconnect re-reads every progress record: wait 1 min (5 min over quota), doubling up to 30 min.
const RECONNECT = { base: 60_000, quota: 5 * 60_000, max: 30 * 60_000 };

export function ProgressSyncBridge({ userId, onStatus }: {
  userId: string | null;
  onStatus: (state: ProgressSyncState) => void;
}) {
  const [retry, setRetry] = useState(0);
  // Kept across re-subscribes: each one re-reads every progress record.
  const listenerFailed = useRef(false);
  const listenFailures = useRef(0);
  useEffect(() => {
    try {
      let writer = localStorage.getItem('shaneweb:progress-writer');
      if (!writer) {
        writer = crypto.randomUUID();
        localStorage.setItem('shaneweb:progress-writer', writer);
      }
      return trackLocalProgress(localStorage, writer);
    } catch { /* Local storage failures are reported by the practice pages. */ }
  }, []);
  useEffect(() => {
    // A healthy listener reconnects by itself after going offline.
    const online = () => { if (listenerFailed.current) setRetry(value => value + 1); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);
  useEffect(() => { listenFailures.current = 0; }, [userId]);
  useEffect(() => {
    listenerFailed.current = false;
    const firebase = getFirebaseServices();
    if (!firebase || !userId) {
      onStatus({ status: 'idle', error: '' });
      return;
    }
    const reconnect = () => { if (listenerFailed.current) setRetry(value => value + 1); };
    window.addEventListener(PROGRESS_SYNC_NOW_EVENT, reconnect);
    try {
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      const progress = collection(firebase.db, 'users', userId, 'progress');
      const disconnect = connectProgressSync(localStorage, userId, {
        listen(receive, failed) {
          return onSnapshot(progress, { includeMetadataChanges: true }, snapshot => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
            listenFailures.current = 0;
            receive(Object.fromEntries(snapshot.docs.map(item => [item.id, item.data()])));
          }, (cause) => {
            listenerFailed.current = true;
            failed(cause);
            const pause = listenRetryDelay(cause, listenFailures.current, RECONNECT);
            // Rules, account or setup problems wait for 立即同步, going online or another account.
            if (pause === null) return;
            listenFailures.current++;
            reconnectTimer = setTimeout(() => setRetry(value => value + 1), pause);
          });
        },
        write(id, record) {
          return runTransaction(firebase.db, async transaction => {
            const ref = doc(progress, id);
            const snapshot = await transaction.get(ref);
            const remote = snapshot.exists() ? parseProgressRecord(id, snapshot.data()) : null;
            if (snapshot.exists() && !remote) throw new Error('Invalid cloud progress');
            if (remote && compareProgress(remote, record) >= 0) return remote;
            transaction.set(ref, { ...record, syncedAt: serverTimestamp() });
            return record;
          });
        },
      }, onStatus);
      return () => { clearTimeout(reconnectTimer); window.removeEventListener(PROGRESS_SYNC_NOW_EVENT, reconnect); disconnect(); };
    } catch {
      // Storage may have room again by the next 立即同步 or online event.
      listenerFailed.current = true;
      onStatus({ status: 'error', error: '無法同步未完成作答，請確認瀏覽器儲存空間與 Firebase 設定。' });
      return () => window.removeEventListener(PROGRESS_SYNC_NOW_EVENT, reconnect);
    }
  }, [onStatus, retry, userId]);
  return null;
}
