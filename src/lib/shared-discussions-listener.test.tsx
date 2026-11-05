import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharedDiscussions } from '@/lib/shared-discussions';

const firestore = vi.hoisted(() => ({
  onSnapshot: vi.fn(() => () => {}),
  query: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  ...firestore,
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadString: vi.fn(),
}));
vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  getFirebaseServices: () => ({ db: {} }),
}));
vi.mock('@/components/cloud-sync-provider', () => ({
  useOptionalCloudSync: () => null,
}));
vi.mock('@/state/app-state', () => ({
  useAppState: () => ({ state: { discussionPosts: [] }, dispatch: vi.fn() }),
}));

describe('useSharedDiscussions', () => {
  beforeEach(() => firestore.onSnapshot.mockClear());
  afterEach(cleanup);

  it('listens to the posts of the question on screen', () => {
    const { result } = renderHook(() => useSharedDiscussions('law-114-01'));

    expect(firestore.onSnapshot).toHaveBeenCalledOnce();
    expect(firestore.where).toHaveBeenLastCalledWith('questionId', '==', 'law-114-01');
    expect(result.current.loading).toBe(true);
  });

  it('opens no listener when no question is on screen, and waits for nothing', () => {
    const { result } = renderHook(() => useSharedDiscussions(null));

    expect(firestore.onSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.posts).toEqual([]);
  });
});
