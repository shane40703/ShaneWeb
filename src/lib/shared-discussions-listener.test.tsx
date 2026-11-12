import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharedDiscussions } from '@/lib/shared-discussions';

type Constraint = { field: string; op: string; value: unknown };
type Listener = {
  path: string;
  constraints: Constraint[];
  options?: { includeMetadataChanges?: boolean };
  next: (snapshot: unknown) => void;
  active: boolean;
};

const listeners = vi.hoisted(() => [] as Listener[]);
const cloud = vi.hoisted(() => ({ user: null as { uid: string } | null }));

const firestore = vi.hoisted(() => {
  const target = (_db: unknown, ...path: string[]) => ({
    path: path.join('/'),
    constraints: [] as Constraint[],
  });
  return {
    onSnapshot: vi.fn(
      (
        { path, constraints }: { path: string; constraints: Constraint[] },
        ...args: unknown[]
      ) => {
        // As in the SDK, the options object before the callbacks is optional.
        const options =
          typeof args[0] === 'function'
            ? undefined
            : (args.shift() as Listener['options']);
        const next = args[0] as Listener['next'];
        const listener: Listener = { path, constraints, options, next, active: true };
        listeners.push(listener);
        return () => {
          listener.active = false;
        };
      },
    ),
    query: vi.fn((base: { path: string }, ...constraints: Constraint[]) => ({
      path: base.path,
      constraints,
    })),
    collection: vi.fn(target),
    doc: vi.fn(target),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  };
});

vi.mock('firebase/firestore', () => ({
  ...firestore,
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
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
  useOptionalCloudSync: () =>
    cloud.user ? { user: cloud.user, signIn: async () => {} } : null,
}));
vi.mock('@/state/app-state', () => ({
  useAppState: () => ({ state: { discussionPosts: [] }, dispatch: vi.fn() }),
}));

const activePaths = () =>
  listeners.filter((listener) => listener.active).map((listener) => listener.path);

const listenerAt = (path: string) =>
  listeners.findLast((listener) => listener.active && listener.path === path)!;

// The server answers unless `fromCache` says the device's cache answered on its own.
function answerPosts(questionId: string, postIds: string[], { fromCache = false } = {}) {
  act(() =>
    listenerAt('discussionPosts').next({
      size: postIds.length,
      metadata: { fromCache, hasPendingWrites: false },
      docs: postIds.map((id) => ({
        id,
        data: () => ({
          questionId,
          type: 'explanation',
          content: `${id} 的內容`,
          // One author per post: a second explanation by the same author is folded away.
          authorId: `author-of-${id}`,
          createdAt: { toDate: () => new Date('2026-11-01T00:00:00.000Z') },
        }),
      })),
    }),
  );
}

describe('useSharedDiscussions', () => {
  beforeEach(() => {
    firestore.onSnapshot.mockClear();
    listeners.length = 0;
    cloud.user = null;
  });
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

  it("reads each post's replies, likes and the reader's report by default", () => {
    cloud.user = { uid: 'reader-1' };
    const { result } = renderHook(() => useSharedDiscussions('law-114-01'));
    answerPosts('law-114-01', ['post-1', 'post-2']);

    expect(activePaths()).toEqual([
      'discussionPosts',
      'discussionPosts/post-1/replies',
      'discussionPosts/post-1/likes',
      'discussionPosts/post-1/reports/reader-1',
      'discussionPosts/post-2/replies',
      'discussionPosts/post-2/likes',
      'discussionPosts/post-2/reports/reader-1',
    ]);
    act(() =>
      listenerAt('discussionPosts/post-1/likes').next({
        size: 2,
        docs: [{ id: 'reader-1' }, { id: 'reader-2' }],
      }),
    );
    expect(result.current.posts.find((post) => post.id === 'post-1')).toMatchObject({
      likes: 2,
      likedByCurrentUser: true,
    });
  });

  it('reads the posts alone with reactions off', () => {
    cloud.user = { uid: 'reader-1' };
    const { result } = renderHook(() =>
      useSharedDiscussions('law-114-01', { reactions: false }),
    );
    expect(result.current.loading).toBe(true);
    answerPosts('law-114-01', ['post-1']);

    expect(activePaths()).toEqual(['discussionPosts']);
    expect(firestore.onSnapshot).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(false);
    expect(result.current.posts).toEqual([
      expect.objectContaining({
        id: 'post-1',
        content: 'post-1 的內容',
        replies: [],
        likes: 0,
        likedByCurrentUser: false,
        reported: false,
      }),
    ]);
  });

  it('leaves no listener behind when reactions are turned off or the question changes', () => {
    cloud.user = { uid: 'reader-1' };
    const { result, rerender } = renderHook(
      ({ questionId, reactions }) => useSharedDiscussions(questionId, { reactions }),
      { initialProps: { questionId: 'law-114-01', reactions: true } },
    );
    answerPosts('law-114-01', ['post-1']);
    act(() =>
      listenerAt('discussionPosts/post-1/likes').next({
        size: 1,
        docs: [{ id: 'reader-1' }],
      }),
    );
    expect(result.current.posts[0]).toMatchObject({ likes: 1, likedByCurrentUser: true });

    rerender({ questionId: 'law-114-01', reactions: false });
    expect(activePaths()).toEqual(['discussionPosts']);
    expect(result.current.posts[0]).toMatchObject({
      likes: 0,
      likedByCurrentUser: false,
    });

    rerender({ questionId: 'law-114-02', reactions: false });
    expect(listeners.filter((listener) => listener.active)).toEqual([
      expect.objectContaining({
        path: 'discussionPosts',
        constraints: [{ field: 'questionId', op: '==', value: 'law-114-02' }],
      }),
    ]);
  });

  it('ends loading on any answer by default, cached or not, without metadata changes', () => {
    const { result } = renderHook(() => useSharedDiscussions('law-114-01'));
    expect(listenerAt('discussionPosts').options?.includeMetadataChanges ?? false).toBe(
      false,
    );

    answerPosts('law-114-01', [], { fromCache: true });
    expect(result.current.loading).toBe(false);
  });

  it('with waitForServer, keeps loading through cached answers until the server answers', () => {
    const { result } = renderHook(() =>
      useSharedDiscussions('law-114-01', { reactions: false, waitForServer: true }),
    );
    // A server answer that matches the cached one arrives only as a metadata change.
    expect(listenerAt('discussionPosts').options).toEqual({
      includeMetadataChanges: true,
    });

    answerPosts('law-114-01', [], { fromCache: true });
    expect(result.current).toMatchObject({ loading: true, posts: [] });
    answerPosts('law-114-01', ['post-1'], { fromCache: true });
    expect(result.current.loading).toBe(true);
    expect(result.current.posts).toEqual([expect.objectContaining({ id: 'post-1' })]);

    answerPosts('law-114-01', ['post-1']);
    expect(result.current.loading).toBe(false);
    // Going offline later raises a cached answer again; the server has answered by then.
    answerPosts('law-114-01', ['post-1'], { fromCache: true });
    expect(result.current.loading).toBe(false);
  });
});
