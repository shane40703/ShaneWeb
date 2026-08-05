import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firebaseConfigurationAvailable, getFirebaseServices } from '@/lib/firebase-client';
import type { ContentReport } from '@/lib/types';

export async function addSharedContentReport(
  report: Omit<ContentReport, 'id' | 'createdAt'>,
  userId: string,
) {
  if (!firebaseConfigurationAvailable()) return false;
  const firebase = getFirebaseServices();
  if (!firebase) return false;
  await addDoc(collection(firebase.db, 'contentReports'), {
    ...report,
    reporterId: userId,
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return true;
}
