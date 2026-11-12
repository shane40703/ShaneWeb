import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase-client';
import { compareProgress, parseProgressRecord } from '@/lib/progress-sync';
import { connectProgressSync, trackLocalProgress, type ProgressSyncState } from '@/lib/progress-sync-client';
import { PROGRESS_SYNC_NOW_EVENT } from '@/lib/progress-events';

export function ProgressSyncBridge({ userId, onStatus }: {
  userId: string | null;
  onStatus: (state: ProgressSyncState) => void;
}) {
  const [retry, setRetry] = useState(0);
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
    const online = () => setRetry(value => value + 1);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);
  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !userId) {
      onStatus({ status: 'idle', error: '' });
      return;
    }
    try {
      let listenerFailed = false;
      let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
      const progress = collection(firebase.db, 'users', userId, 'progress');
      const disconnect = connectProgressSync(localStorage, userId, {
        listen(receive, failed) {
          return onSnapshot(progress, { includeMetadataChanges: true }, snapshot => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
            receive(Object.fromEntries(snapshot.docs.map(item => [item.id, item.data()])));
          }, (cause) => {
            listenerFailed = true;
            failed(cause);
            const quota = cause?.code === 'resource-exhausted';
            reconnectTimer = setTimeout(() => setRetry(value => value + 1), quota ? 300_000 : 60_000);
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
      const reconnect = () => { if (listenerFailed) setRetry(value => value + 1); };
      window.addEventListener(PROGRESS_SYNC_NOW_EVENT, reconnect);
      return () => { clearTimeout(reconnectTimer); window.removeEventListener(PROGRESS_SYNC_NOW_EVENT, reconnect); disconnect(); };
    } catch {
      onStatus({ status: 'error', error: '無法同步未完成作答，請確認瀏覽器儲存空間與 Firebase 設定。' });
    }
  }, [onStatus, retry, userId]);
  return null;
}
