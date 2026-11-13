import { collection, doc, onSnapshot, orderBy, query, runTransaction, Timestamp, where, type Firestore } from 'firebase/firestore';
import { parsePushMessage, type PushMessage, type PushReceipt } from '@/lib/push-messages';

export interface PushTransport {
  subscribe: (test: boolean, next: (messages: PushMessage[]) => void, error: () => void) => () => void;
  record: (receipt: PushReceipt, browserId: string) => Promise<{ delivered: boolean; read: boolean; alreadyRead: boolean }>;
}

export function firestorePushTransport(db: Firestore): PushTransport {
  return {
    subscribe(test, next, error) {
      const active = query(collection(db, 'pushMessages'),
        where('status', test ? 'in' : '==', test ? ['live', 'test'] : 'live'),
        where('expiresAt', '>', Timestamp.now()), orderBy('expiresAt', 'asc'));
      return onSnapshot(active, (snapshot) => next(snapshot.docs.flatMap((item) => {
        const message = parsePushMessage(item.id, item.data());
        return message ? [message] : [];
      })), error);
    },
    async record(receipt, browserId) {
      const parent = doc(db, 'pushMessages', receipt.id);
      const receiptId = `${receipt.status}_${browserId}`;
      const target = doc(parent, 'receipts', receiptId);
      const stats = doc(parent, 'stats', receipt.status);
      const commit = () => runTransaction(db, async (transaction) => {
        const [messageSnapshot, receiptSnapshot, statsSnapshot] = await Promise.all([
          transaction.get(parent), transaction.get(target), transaction.get(stats),
        ]);
        const message = messageSnapshot.exists() ? parsePushMessage(parent.id, messageSnapshot.data()) : null;
        if (!message || message.status !== receipt.status) return { delivered: false, read: false, alreadyRead: false };
        const previous = receiptSnapshot.data();
        const delivered = !receiptSnapshot.exists();
        const read = receipt.read && previous?.read !== true;
        if (!delivered && !read) return { delivered: false, read: false, alreadyRead: previous?.read === true };
        const data = statsSnapshot.data();
        // Do not update the announcement: every visitor listens to that document.
        // Legacy counters remain on the parent and must be added to these totals.
        transaction.set(stats, {
          delivered: (data?.delivered ?? 0) + Number(delivered),
          read: (data?.read ?? 0) + Number(read),
          lastReceiptId: receiptId,
        });
        transaction.set(target, { status: receipt.status, delivered: true, read: receipt.read || previous?.read === true });
        return { delivered, read, alreadyRead: receipt.read || previous?.read === true };
      });
      try { return await commit(); }
      catch (reason) {
        // A competing tab may commit between the read and rule evaluation. Some
        // backends report a rule denial before the transaction's conflict check.
        // Re-read once; genuine permission failures still reject and stay queued.
        if ((reason as { code?: string }).code === 'permission-denied') return commit();
        throw reason;
      }
    },
  };
}
