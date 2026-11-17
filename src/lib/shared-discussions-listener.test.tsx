import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaperDiscussions, useSharedDiscussions } from '@/lib/shared-discussions';

type Constraint = { field: string; op: string; value: unknown };
type Listener = {
  path: string;
  constraints: Constraint[];
  options?: { includeMetadataChanges?: boolean; source?: string };
  next: (snapshot: unknown) => void;
  error: (reason: unknown) => void;
  active: boolean;
};

const listeners = vi.hoisted(() => [] as Listener[]);
const cloud = vi.hoisted(() => ({ user: null as { uid: string } | null }));
// Configured and running, unless a test holds Firebase back as the crawler guard does.
const firebase = vi.hoisted(() => {
  const setup = {
    configured: true,
    services: { db: {} } as { db: object } | null,
  };
  return { ...setup, getServices: vi.fn(() => firebase.services) };
});

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
        const [next, error] = args as [Listener['next'], Listener['error']];
        const listener: Listener = {
          path,
          constraints,
          options,
          next,
          error,
          active: true,
        };
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
  firebaseConfigurationAvailable: () => firebase.configured,
  firebaseRunsHere: () => firebase.configured && firebase.services !== null,
  getFirebaseServices: () => firebase.getServices(),
}));
vi.mock('@/components/cloud-sync-provider', () => ({
  useOptionalCloudSync: () =>
    cloud.user ? { user: cloud.user, signIn: async () => {} } : null,
}));
// The same state every render, as the app's store keeps it until something changes.
const appState = vi.hoisted(() => ({
  state: { discussionPosts: [] },
  dispatch: () => {},
}));
vi.mock('@/state/app-state', () => ({ useAppState: () => appState }));

const readFailure = '無法讀取共享投稿，請確認 Firestore 規則與網路連線。';
// The last character of a paper's range, as the hook writes it.
const rangeEnd = String.fromCharCode(0xf8ff);

const activePaths = () =>
  listeners.filter((listener) => listener.active).map((listener) => listener.path);

const listenerAt = (path: string) =>
  listeners.findLast((listener) => listener.active && listener.path === path)!;

// A question's listener and a paper's share a path; their first filter tells them apart.
const listenerFiltering = (op: string) =>
  listeners.findLast(
    (listener) =>
      listener.active &&
      listener.path === 'discussionPosts' &&
      listener.constraints[0]?.op === op,
  )!;

const reactionListeners = () =>
  listeners.filter((listener) => /\/(replies|likes|reports)(\/|$)/.test(listener.path));

type PostDoc = {
  id: string;
  questionId?: string;
  content?: string;
  createdAt?: string;
  authorId?: string;
  deleted?: boolean;
};

// A post as Firestore holds it; one author per post unless it says otherwise, since a second
// explanation by the same author is folded away.
function postSnapshot(
  defaultQuestionId: string,
  posts: Array<string | PostDoc>,
  { fromCache = false, hasPendingWrites = false } = {},
) {
  return {
    size: posts.length,
    metadata: { fromCache, hasPendingWrites },
    docs: posts.map((post) => {
      const {
        id,
        questionId = defaultQuestionId,
        content = `${id} 的內容`,
        createdAt = '2026-11-01T00:00:00.000Z',
        authorId = `author-of-${id}`,
        deleted = false,
      } = typeof post === 'string' ? { id: post } : post;
      return {
        id,
        data: () => ({
          questionId,
          type: 'explanation',
          content,
          authorId,
          deleted,
          createdAt: { toDate: () => new Date(createdAt) },
        }),
      };
    }),
  };
}

// The server answers unless `fromCache` says the device's cache answered on its own.
function answerPosts(
  questionId: string,
  posts: Array<string | PostDoc>,
  { fromCache = false } = {},
) {
  act(() => listenerFiltering('==').next(postSnapshot(questionId, posts, { fromCache })));
}

// Each post names its question; a bare question id stands for one post on it.
function answerPaper(
  posts: Array<string | (PostDoc & { questionId: string })>,
  metadata: { fromCache?: boolean; hasPendingWrites?: boolean } = {},
) {
  act(() =>
    listenerFiltering('>=').next(
      postSnapshot(
        '',
        posts.map((post, index) =>
          typeof post === 'string' ? { id: `post-${index + 1}`, questionId: post } : post,
        ),
        metadata,
      ),
    ),
  );
}

beforeEach(() => {
  firestore.onSnapshot.mockClear();
  listeners.length = 0;
  cloud.user = null;
  firebase.configured = true;
  firebase.services = { db: {} };
  firebase.getServices.mockClear();
});
afterEach(cleanup);

describe('useSharedDiscussions', () => {
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

  it('starts no Firebase just to render, with or without a question or a paper', () => {
    renderHook(() => ({
      question: useSharedDiscussions(null),
      paper: usePaperDiscussions(null),
    }));
    expect(firebase.getServices).not.toHaveBeenCalled();

    // Firebase starts for a listener alone, in an effect, and not to learn it may run.
    renderHook(() => useSharedDiscussions('law-114-01'));
    expect(firebase.getServices).toHaveBeenCalledOnce();
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

  it('keeps every reaction listener through an edit or a new order, until the posts change', () => {
    cloud.user = { uid: 'reader-1' };
    const { result } = renderHook(() => useSharedDiscussions('law-114-01'));
    answerPosts('law-114-01', ['post-1', 'post-2']);
    const opened = reactionListeners();
    expect(opened).toHaveLength(6);
    act(() =>
      listenerAt('discussionPosts/post-1/likes').next({
        size: 2,
        docs: [{ id: 'reader-1' }, { id: 'reader-2' }],
      }),
    );
    const calls = firestore.onSnapshot.mock.calls.length;

    // The author edits post-1, and then post-2 turns out to be the newer one.
    answerPosts('law-114-01', [{ id: 'post-1', content: '修改後的內容' }, 'post-2']);
    answerPosts('law-114-01', [
      { id: 'post-1', content: '修改後的內容' },
      { id: 'post-2', createdAt: '2026-11-02T00:00:00.000Z' },
    ]);
    expect(result.current.posts).toEqual([
      expect.objectContaining({ id: 'post-2' }),
      expect.objectContaining({ id: 'post-1', content: '修改後的內容', likes: 2 }),
    ]);
    expect(firestore.onSnapshot).toHaveBeenCalledTimes(calls);
    expect(opened.every((listener) => listener.active)).toBe(true);

    // A new post makes a new set of posts, which is read again.
    answerPosts('law-114-01', ['post-1', 'post-2', 'post-3']);
    expect(opened.some((listener) => listener.active)).toBe(false);
    expect(activePaths()).toEqual([
      'discussionPosts',
      'discussionPosts/post-1/replies',
      'discussionPosts/post-1/likes',
      'discussionPosts/post-1/reports/reader-1',
      'discussionPosts/post-2/replies',
      'discussionPosts/post-2/likes',
      'discussionPosts/post-2/reports/reader-1',
      'discussionPosts/post-3/replies',
      'discussionPosts/post-3/likes',
      'discussionPosts/post-3/reports/reader-1',
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

  it('settles on no posts when Firebase is configured but held back', () => {
    firebase.services = null;
    const { result } = renderHook(() => {
      const paper = usePaperDiscussions('law-114-');
      return {
        question: useSharedDiscussions('law-114-01'),
        fromPaper: useSharedDiscussions('law-114-01', { paper }),
        paper,
      };
    });

    expect(firestore.onSnapshot).not.toHaveBeenCalled();
    expect(result.current.question).toMatchObject({
      enabled: true,
      loading: false,
      posts: [],
      error: '',
    });
    expect(result.current.fromPaper).toMatchObject({
      loading: false,
      posts: [],
      error: '',
    });
    expect(result.current.paper).toMatchObject({ ready: true, settled: true, error: '' });
    expect([...result.current.paper.questionIds]).toEqual([]);
  });
});

describe("useSharedDiscussions with its paper's posts", () => {
  function renderQuestion(questionId: string, { reactions = false } = {}) {
    return renderHook(
      ({ questionId: shown }) => {
        const paper = usePaperDiscussions('law-114-');
        return { paper, question: useSharedDiscussions(shown, { paper, reactions }) };
      },
      { initialProps: { questionId } },
    );
  }

  it('opens no listener for its posts, and takes them from the paper', () => {
    const { result, rerender } = renderQuestion('law-114-01');
    const paper = listenerFiltering('>=');
    expect(listeners).toEqual([paper]);
    expect(result.current.question).toMatchObject({ loading: true, posts: [] });

    answerPaper([
      { id: 'post-1', questionId: 'law-114-01' },
      { id: 'post-2', questionId: 'law-114-02' },
    ]);
    expect(result.current.question).toMatchObject({
      loading: false,
      posts: [expect.objectContaining({ id: 'post-1', content: 'post-1 的內容' })],
    });

    // The next question of the paper shows at once, from the same read.
    rerender({ questionId: 'law-114-02' });
    expect(result.current.question).toMatchObject({
      loading: false,
      posts: [expect.objectContaining({ id: 'post-2' })],
    });
    rerender({ questionId: 'law-114-03' });
    expect(result.current.question).toMatchObject({ loading: false, posts: [] });
    expect(listeners).toEqual([paper]);
    expect(paper.active).toBe(true);
  });

  it('reads the posts as its own listener would: newest first, one explanation per author', () => {
    const { result } = renderQuestion('law-114-01');
    answerPaper([
      { id: 'old', questionId: 'law-114-01', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 'new', questionId: 'law-114-01', createdAt: '2026-11-03T00:00:00.000Z' },
      { id: 'gone', questionId: 'law-114-01', deleted: true },
      {
        id: 'first-copy',
        questionId: 'law-114-01',
        authorId: 'author-1',
        createdAt: '2026-11-01T12:00:00.000Z',
      },
      {
        id: 'latest-copy',
        questionId: 'law-114-01',
        authorId: 'author-1',
        createdAt: '2026-11-02T00:00:00.000Z',
      },
      // The same author on another question is another explanation.
      { id: 'elsewhere', questionId: 'law-114-02', authorId: 'author-1' },
    ]);

    expect(result.current.question.posts.map((post) => post.id)).toEqual([
      'new',
      'latest-copy',
      'old',
    ]);
    expect(result.current.paper.posts.get('law-114-02')?.map((post) => post.id)).toEqual([
      'elsewhere',
    ]);
    expect([...result.current.paper.questionIds]).toEqual(['law-114-01', 'law-114-02']);
  });

  it('waits for the paper, and until it settles only posts end the wait', () => {
    const { result, rerender } = renderQuestion('law-114-02');
    // Another view of this tab read the first question's posts, so the cache answers the
    // paper with those alone before the server does.
    answerPaper(['law-114-01'], { fromCache: true });
    expect(result.current.paper).toMatchObject({ ready: true, settled: false });
    expect(result.current.question).toMatchObject({ loading: true, posts: [] });

    // The first question has posts in that answer, so it waits no longer.
    rerender({ questionId: 'law-114-01' });
    expect(result.current.question.loading).toBe(false);

    // The server has none for the second question either.
    rerender({ questionId: 'law-114-02' });
    answerPaper(['law-114-01']);
    expect(result.current.question).toMatchObject({ loading: false, posts: [] });
  });

  it("takes the paper's failure for its own", () => {
    const { result } = renderQuestion('law-114-01');
    act(() => listenerFiltering('>=').error(new Error('resource-exhausted')));

    expect(result.current.question).toMatchObject({
      loading: false,
      posts: [],
      error: readFailure,
    });
  });

  it("reads reactions for the question's posts alone, by their ids", () => {
    cloud.user = { uid: 'reader-1' };
    const { result } = renderQuestion('law-114-01', { reactions: true });
    answerPaper([
      { id: 'post-1', questionId: 'law-114-01' },
      { id: 'post-2', questionId: 'law-114-02' },
    ]);
    expect(activePaths()).toEqual([
      'discussionPosts',
      'discussionPosts/post-1/replies',
      'discussionPosts/post-1/likes',
      'discussionPosts/post-1/reports/reader-1',
    ]);
    act(() =>
      listenerAt('discussionPosts/post-1/likes').next({
        size: 1,
        docs: [{ id: 'reader-1' }],
      }),
    );

    // An edit, or a new post on another question, keeps every listener.
    const calls = firestore.onSnapshot.mock.calls.length;
    answerPaper([
      { id: 'post-1', questionId: 'law-114-01', content: '修改後的內容' },
      { id: 'post-2', questionId: 'law-114-02' },
      { id: 'post-3', questionId: 'law-114-02' },
    ]);
    expect(firestore.onSnapshot).toHaveBeenCalledTimes(calls);
    expect(result.current.question.posts).toEqual([
      expect.objectContaining({
        id: 'post-1',
        content: '修改後的內容',
        likes: 1,
        likedByCurrentUser: true,
      }),
    ]);
  });
});

describe('usePaperDiscussions', () => {
  it("is ready once the paper's listener answers, from the server or the cache", () => {
    const { result, rerender } = renderHook(({ prefix }) => usePaperDiscussions(prefix), {
      initialProps: { prefix: 'law-114-' },
    });
    expect(listeners).toEqual([
      expect.objectContaining({
        path: 'discussionPosts',
        constraints: [
          { field: 'questionId', op: '>=', value: 'law-114-' },
          { field: 'questionId', op: '<', value: `law-114-${rangeEnd}` },
        ],
        // It answers from the cache when the cache holds any of the paper; the server's answer
        // can then change the metadata alone.
        options: { includeMetadataChanges: true },
      }),
    ]);
    expect(result.current).toMatchObject({ ready: false, settled: false, error: '' });

    answerPaper(['law-114-03'], { fromCache: true });
    expect(result.current).toMatchObject({ ready: true, settled: false });
    expect([...result.current.questionIds]).toEqual(['law-114-03']);
    // The cache may have held only some of the paper; the server's answer settles it.
    answerPaper(['law-114-03']);
    expect(result.current).toMatchObject({ ready: true, settled: true });

    // Another paper waits for its own answer.
    rerender({ prefix: 'law-113-' });
    expect(result.current).toMatchObject({ ready: false, settled: false });
    answerPaper([]);
    expect(result.current).toMatchObject({ ready: true, settled: true, error: '' });
  });

  it('waits again for a paper read anew, back from its overview or another paper', () => {
    const { result, rerender } = renderHook(
      ({ prefix }: { prefix: string | null }) => usePaperDiscussions(prefix),
      { initialProps: { prefix: 'law-114-' as string | null } },
    );
    answerPaper(['law-114-03']);
    expect(result.current).toMatchObject({ ready: true, settled: true });

    // The paper's overview reads nothing; back on the paper, a new listener reads it.
    rerender({ prefix: null });
    rerender({ prefix: 'law-114-' });
    expect(result.current).toMatchObject({ ready: false, settled: false });
    answerPaper(['law-114-03'], { fromCache: true });
    expect(result.current).toMatchObject({ ready: true, settled: false });
    answerPaper(['law-114-03']);

    // Another paper, left before it answered, and back.
    rerender({ prefix: 'law-113-' });
    rerender({ prefix: 'law-114-' });
    expect(result.current).toMatchObject({ ready: false, settled: false });
    answerPaper(['law-114-03']);
    expect(result.current).toMatchObject({ ready: true, settled: true });
  });

  it('drops an earlier failure once the paper is read anew', () => {
    const { result, rerender } = renderHook(
      ({ prefix }: { prefix: string | null }) => usePaperDiscussions(prefix),
      { initialProps: { prefix: 'law-114-' as string | null } },
    );
    act(() => listenerFiltering('>=').error(new Error('unavailable')));
    expect(result.current.error).toBe(readFailure);

    rerender({ prefix: null });
    rerender({ prefix: 'law-114-' });
    expect(result.current).toMatchObject({ ready: false, settled: false, error: '' });
    answerPaper(['law-114-03']);
    expect(result.current).toMatchObject({ ready: true, settled: true, error: '' });
  });

  it('keeps its read, and renders nothing, for an answer that changes no post', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return usePaperDiscussions('law-114-');
    });
    const posts = [
      { id: 'post-1', questionId: 'law-114-01' },
      { id: 'post-2', questionId: 'law-114-02' },
    ];
    answerPaper(posts, { fromCache: true });
    const { questionIds, posts: byQuestion } = result.current;

    // The server confirms the cache: the metadata alone changes, and the paper settles.
    answerPaper(posts);
    expect(result.current.settled).toBe(true);
    expect(result.current.questionIds).toBe(questionIds);
    expect(result.current.posts).toBe(byQuestion);

    // A write on its way and confirmed, then a spell offline and back, change no post either:
    // React may call the hook once to find its state unchanged, and renders nothing after.
    const settledRenders = renders;
    answerPaper(posts, { hasPendingWrites: true });
    answerPaper(posts);
    answerPaper(posts, { fromCache: true });
    answerPaper(posts);
    expect(renders - settledRenders).toBeLessThanOrEqual(1);
    expect(result.current.questionIds).toBe(questionIds);
    expect(result.current.posts).toBe(byQuestion);

    answerPaper([{ id: 'post-1', questionId: 'law-114-01', content: '修改後的內容' }]);
    expect(result.current.questionIds).not.toBe(questionIds);
    expect(result.current.posts.get('law-114-01')).toEqual([
      expect.objectContaining({ content: '修改後的內容' }),
    ]);
  });

  it('settles for the cached answer offline, at once or after 10 s', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ prefix }) => usePaperDiscussions(prefix),
        {
          initialProps: { prefix: 'law-114-' },
        },
      );
      answerPaper([], { fromCache: true });
      expect(result.current.settled).toBe(false);
      act(() => window.dispatchEvent(new Event('offline')));
      expect(result.current.settled).toBe(true);

      // No word from the browser: as long as the SDK itself waits before going offline.
      rerender({ prefix: 'law-113-' });
      answerPaper([], { fromCache: true });
      act(() => vi.advanceTimersByTime(9_999));
      expect(result.current.settled).toBe(false);
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is ready, with an error, when the paper's listener fails", () => {
    const { result, rerender } = renderHook(({ prefix }) => usePaperDiscussions(prefix), {
      initialProps: { prefix: 'law-114-' },
    });

    act(() => listenerFiltering('>=').error(new Error('resource-exhausted')));
    expect(result.current).toMatchObject({
      ready: true,
      settled: true,
      error: readFailure,
    });

    rerender({ prefix: 'law-113-' });
    expect(result.current).toMatchObject({ ready: false, error: '' });
    answerPaper([]);
    expect(result.current).toMatchObject({ ready: true, error: '' });
  });

  it('waits for nothing without a paper or without Firebase', () => {
    const overview = renderHook(() => usePaperDiscussions(null));
    expect(overview.result.current).toMatchObject({ ready: true, settled: true });

    firebase.configured = false;
    const local = renderHook(() => usePaperDiscussions('law-114-'));
    expect(local.result.current).toMatchObject({ ready: true, settled: true });
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });
});
