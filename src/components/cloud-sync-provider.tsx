import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import {
  firebaseConfigurationAvailable,
  getFirebaseServices,
} from '@/lib/firebase-client';
import { isQuizAttempt } from '@/lib/study';
import type { QuizAttempt, SyncedNote } from '@/lib/types';
import { useAppState } from '@/state/app-state';

type CloudSyncStatus =
  | 'disabled'
  | 'signed-out'
  | 'syncing'
  | 'synced'
  | 'error';

interface CloudSyncContextValue {
  user: User | null;
  status: CloudSyncStatus;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

function cloudAttempt(data: unknown): QuizAttempt | null {
  if (!data || typeof data !== 'object') return null;
  const attempt = { ...(data as Record<string, unknown>) };
  delete attempt.syncedAt;
  return isQuizAttempt(attempt) && attempt.mode === 'paper' ? attempt : null;
}

export function parseCloudNote(data: DocumentData): SyncedNote | null {
  return typeof data.questionId === 'string' &&
    typeof data.content === 'string' &&
    typeof data.updatedAt === 'string'
    ? {
        questionId: data.questionId,
        content: data.content,
        updatedAt: data.updatedAt,
      }
    : null;
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, hydrated } = useAppState();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<CloudSyncStatus>(() =>
    firebaseConfigurationAvailable() ? 'signed-out' : 'disabled',
  );
  const [error, setError] = useState('');
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const syncedAttemptIds = useRef(new Set<string>());
  const syncedNoteVersions = useRef(new Map<string, string>());
  const localAttempts = useRef(state.attempts);
  const localNotes = useRef({
    notes: state.notes,
    noteUpdatedAt: state.noteUpdatedAt,
  });

  useEffect(() => {
    localAttempts.current = state.attempts;
  }, [state.attempts]);

  useEffect(() => {
    localNotes.current = {
      notes: state.notes,
      noteUpdatedAt: state.noteUpdatedAt,
    };
  }, [state.noteUpdatedAt, state.notes]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, (nextUser) => {
      setUser(nextUser);
      setReadyUserId(null);
      syncedAttemptIds.current.clear();
      syncedNoteVersions.current.clear();
      setError('');
      setStatus(nextUser ? 'syncing' : 'signed-out');
    });
  }, []);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || !hydrated) return;

    let active = true;
    let stopListening: (() => void) | undefined;
    let stopListeningToNotes: (() => void) | undefined;
    const attempts = collection(firebase.db, 'users', user.uid, 'attempts');
    const notes = collection(firebase.db, 'users', user.uid, 'notes');

    void (async () => {
      try {
        const snapshot = await getDocs(attempts);
        if (!active) return;
        const remoteAttempts = snapshot.docs.flatMap((item) => {
          const attempt = cloudAttempt(item.data());
          return attempt ? [attempt] : [];
        });
        remoteAttempts.forEach((attempt) =>
          syncedAttemptIds.current.add(attempt.id),
        );
        dispatch({ type: 'merge-attempts', attempts: remoteAttempts });

        const noteSnapshot = await getDocs(notes);
        if (!active) return;
        const remoteNotes = noteSnapshot.docs.flatMap((item) => {
          const note = parseCloudNote(item.data());
          return note ? [note] : [];
        });
        remoteNotes.forEach((note) =>
          syncedNoteVersions.current.set(note.questionId, note.updatedAt),
        );
        dispatch({ type: 'merge-notes', notes: remoteNotes });

        await Promise.all(
          localAttempts.current.map((attempt) =>
            setDoc(
              doc(attempts, attempt.id),
              { ...attempt, syncedAt: serverTimestamp() },
              { merge: true },
            ),
          ),
        );
        if (!active) return;
        localAttempts.current.forEach((attempt) =>
          syncedAttemptIds.current.add(attempt.id),
        );

        const remoteNoteIds = new Set(
          remoteNotes.map((note) => note.questionId),
        );
        const legacyLocalNotes = Object.keys(localNotes.current.notes)
          .filter(
            (questionId) =>
              !localNotes.current.noteUpdatedAt[questionId] &&
              !remoteNoteIds.has(questionId),
          )
          .map((questionId) => ({
            questionId,
            content: localNotes.current.notes[questionId],
            updatedAt: new Date().toISOString(),
          }));
        if (legacyLocalNotes.length) {
          dispatch({ type: 'merge-notes', notes: legacyLocalNotes });
          await Promise.all(
            legacyLocalNotes.map((note) =>
              setDoc(
                doc(notes, note.questionId),
                { ...note, syncedAt: serverTimestamp() },
                { merge: true },
              ),
            ),
          );
          legacyLocalNotes.forEach((note) =>
            syncedNoteVersions.current.set(note.questionId, note.updatedAt),
          );
        }
        setReadyUserId(user.uid);
        setStatus('synced');

        stopListening = onSnapshot(
          attempts,
          (nextSnapshot) => {
            const incoming = nextSnapshot.docChanges().flatMap((change) => {
              if (change.type === 'removed') return [];
              const attempt = cloudAttempt(change.doc.data());
              if (attempt) syncedAttemptIds.current.add(attempt.id);
              return attempt ? [attempt] : [];
            });
            if (incoming.length) dispatch({ type: 'merge-attempts', attempts: incoming });
            setStatus('synced');
          },
          () => {
            setError('無法讀取雲端作答紀錄，請確認 Firestore 權限設定。');
            setStatus('error');
          },
        );

        stopListeningToNotes = onSnapshot(
          notes,
          (nextSnapshot) => {
            const incoming = nextSnapshot.docChanges().flatMap((change) => {
              if (change.type === 'removed') return [];
              const note = parseCloudNote(change.doc.data());
              if (note) {
                syncedNoteVersions.current.set(
                  note.questionId,
                  note.updatedAt,
                );
              }
              return note ? [note] : [];
            });
            if (incoming.length) dispatch({ type: 'merge-notes', notes: incoming });
            setStatus('synced');
          },
          () => {
            setError('無法讀取雲端筆記，請確認 Firestore 權限設定。');
            setStatus('error');
          },
        );
      } catch {
        if (!active) return;
        setError('作答紀錄同步失敗，請檢查網路或 Firebase 設定。');
        setStatus('error');
      }
    })();

    return () => {
      active = false;
      stopListening?.();
      stopListeningToNotes?.();
    };
  }, [dispatch, hydrated, user]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || readyUserId !== user.uid) return;
    const unsynced = state.attempts.filter(
      (attempt) => !syncedAttemptIds.current.has(attempt.id),
    );
    if (!unsynced.length) return;

    setStatus('syncing');
    void Promise.all(
      unsynced.map((attempt) =>
        setDoc(
          doc(firebase.db, 'users', user.uid, 'attempts', attempt.id),
          { ...attempt, syncedAt: serverTimestamp() },
          { merge: true },
        ).then(() => syncedAttemptIds.current.add(attempt.id)),
      ),
    )
      .then(() => setStatus('synced'))
      .catch(() => {
        setError('最新作答仍保存在本機，恢復連線後請重新登入同步。');
        setStatus('error');
      });
  }, [readyUserId, state.attempts, user]);

  useEffect(() => {
    const firebase = getFirebaseServices();
    if (!firebase || !user || readyUserId !== user.uid) return;
    const changedNotes = Object.keys(state.noteUpdatedAt).filter(
      (questionId) =>
        syncedNoteVersions.current.get(questionId) !==
        state.noteUpdatedAt[questionId],
    );
    if (!changedNotes.length) return;

    setStatus('syncing');
    void Promise.all(
      changedNotes.map((questionId) => {
        const updatedAt = state.noteUpdatedAt[questionId];
        return setDoc(
          doc(firebase.db, 'users', user.uid, 'notes', questionId),
          {
            questionId,
            content: state.notes[questionId] ?? '',
            updatedAt,
            syncedAt: serverTimestamp(),
          },
          { merge: true },
        ).then(() => syncedNoteVersions.current.set(questionId, updatedAt));
      }),
    )
      .then(() => setStatus('synced'))
      .catch(() => {
        setError('最新筆記仍保存在本機，恢復連線後請重新登入同步。');
        setStatus('error');
      });
  }, [readyUserId, state.noteUpdatedAt, state.notes, user]);

  const handleSignIn = useCallback(async () => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    setStatus('syncing');
    setError('');
    try {
      await signInWithPopup(firebase.auth, new GoogleAuthProvider());
    } catch {
      setStatus('signed-out');
      setError('Google 登入未完成，請確認彈出視窗未被封鎖。');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    const firebase = getFirebaseServices();
    if (!firebase) return;
    await signOut(firebase.auth);
  }, []);

  return (
    <CloudSyncContext.Provider
      value={{
        user,
        status,
        error,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const context = useContext(CloudSyncContext);
  if (!context) throw new Error('useCloudSync must be used within CloudSyncProvider');
  return context;
}
