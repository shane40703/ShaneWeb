import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { ExamsPage } from '@/features/exams/exams-page';
import { examsSlug } from '@/lib/question-path';
import type { Question } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';

type Constraint = { field: string; op: string; value: unknown };
type Listener = {
  path: string;
  constraints: Constraint[];
  options?: { includeMetadataChanges?: boolean; source?: string };
  next: (snapshot: unknown) => void;
  error: (reason: unknown) => void;
  active: boolean;
};

const router = vi.hoisted(() => ({
  isReady: true,
  pathname: '/exams/[[...slug]]',
  query: {} as Record<string, string | string[] | undefined>,
  replace: vi.fn(),
  // Next's push settles once the new place has rendered.
  push: vi.fn(() => Promise.resolve(true)),
}));
// Every onSnapshot is recorded with its target, and the test decides when each one answers.
const listeners = vi.hoisted(() => [] as Listener[]);
// Signed in, so reading reactions would also open a report listener per post.
const cloud = vi.hoisted(() => ({
  value: { user: { uid: 'reader-1' }, signIn: async () => {} },
}));

vi.mock('next/router', () => ({ useRouter: () => router }));
vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  firebaseRunsHere: () => true,
  getFirebaseServices: () => ({ db: {}, auth: { currentUser: null } }),
}));
vi.mock('@/components/cloud-sync-provider', () => ({
  useOptionalCloudSync: () => cloud.value,
}));
vi.mock('firebase/storage', () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadString: vi.fn(),
}));
vi.mock('firebase/firestore', () => {
  const target = (_db: unknown, ...path: string[]) => ({
    path: path.join('/'),
    constraints: [] as Constraint[],
  });
  return {
    collection: target,
    doc: target,
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (base: { path: string }, ...constraints: Constraint[]) => ({
      path: base.path,
      constraints,
    }),
    onSnapshot: (
      { path, constraints }: { path: string; constraints: Constraint[] },
      ...args: unknown[]
    ) => {
      // As in the SDK, the options object before the callbacks is optional.
      const options =
        typeof args[0] === 'function' ? undefined : (args.shift() as Listener['options']);
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
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getDocs: vi.fn(),
    serverTimestamp: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
  };
});

function question(id: string, questionNumber: number): Question {
  return {
    id,
    subject: 'law',
    year: 114,
    questionNumber,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `${id} 題幹`,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: [`${id} A`, `${id} B`, `${id} C`, `${id} D`],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

const questions = [question('law-114-01', 1), question('law-114-02', 2)];
const sharedPost = { id: 'post-1', questionId: 'law-114-01', content: '共享的詳解' };
const secondPost = { id: 'post-2', questionId: 'law-114-02', content: '第二題的詳解' };
const readFailure = '無法讀取共享投稿，請確認 Firestore 規則與網路連線。';
// The last character of a paper's range, as the hook writes it.
const rangeEnd = String.fromCharCode(0xf8ff);

function page() {
  return (
    <ToastProvider>
      <AppStateProvider>
        <ExamsPage questions={questions} />
      </AppStateProvider>
    </ToastProvider>
  );
}

const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

// The paper's listener and any listener of a question's own share this path.
const postListeners = () =>
  listeners.filter((listener) => listener.path === 'discussionPosts');

const paperListener = () =>
  listeners.findLast(
    (listener) => listener.active && listener.constraints[0]?.op === '>=',
  )!;

const activeReactionPaths = () =>
  listeners
    .filter(
      (listener) =>
        listener.active && /\/(replies|likes|reports)(\/|$)/.test(listener.path),
    )
    .map((listener) => listener.path);

function snapshot(posts: (typeof sharedPost)[], { fromCache = false } = {}) {
  return {
    size: posts.length,
    metadata: { fromCache, hasPendingWrites: false },
    docs: posts.map((post) => ({
      id: post.id,
      data: () => ({
        questionId: post.questionId,
        type: 'explanation',
        content: post.content,
        authorId: `author-of-${post.id}`,
        createdAt: { toDate: () => new Date('2026-11-01T00:00:00.000Z') },
      }),
    })),
  };
}

// The server answers unless `fromCache` says the device's cache answered on its own.
function answerPaper(
  posts: (typeof sharedPost)[],
  options: { fromCache?: boolean } = {},
) {
  act(() => paperListener().next(snapshot(posts, options)));
}

// jsdom does not scroll.
vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

describe('ExamsPage discussion reads', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listeners.length = 0;
    router.isReady = true;
    router.query = { slug: examsSlug('law-114-01') };
    router.replace.mockReset();
    router.push.mockReset();
  });
  afterEach(cleanup);

  it("reads each question from its paper's read, with no listener of its own", () => {
    const view = render(page());

    // One read, the paper's, which its tiles need anyway.
    expect(postListeners()).toEqual([
      expect.objectContaining({
        constraints: [
          { field: 'questionId', op: '>=', value: 'law-114-' },
          { field: 'questionId', op: '<', value: `law-114-${rangeEnd}` },
        ],
        active: true,
      }),
    ]);

    // 下一題 stays in the paper, and shows its posts from the same read at once.
    const paper = paperListener();
    answerPaper([sharedPost, secondPost]);
    router.query = { slug: examsSlug('law-114-02'), tab: 'discussion' };
    view.rerender(page());
    expect(screen.getByText('第二題的詳解')).toBeInTheDocument();
    expect(screen.queryByText('正在載入共享投稿…')).not.toBeInTheDocument();
    expect(postListeners()).toEqual([paper]);
    expect(paper.active).toBe(true);
  });

  it('waits for the paper before saying there is no explanation, then shows and counts its posts', () => {
    render(page());
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));
    expect(screen.getByText('正在載入詳解…')).toBeInTheDocument();
    expect(screen.queryByText('目前尚無詳解。')).not.toBeInTheDocument();

    answerPaper([sharedPost]);
    expect(screen.getByText('共享的詳解')).toBeInTheDocument();
    expect(screen.queryByText('正在載入詳解…')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /討論區/ })).toHaveTextContent('討論區1');
    expect(
      within(screen.getByRole('group', { name: '題號' })).getByRole('link', {
        name: '第 1 題（有詳解或討論）',
      }),
    ).toBeInTheDocument();
  });

  it("does not take the paper's partial answer from the cache for no explanation", () => {
    router.query = { slug: examsSlug('law-114-02') };
    render(page());
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));
    // Another view of this tab read the first question's posts, so the cache answers the
    // paper with those alone before the server does.
    answerPaper([sharedPost], { fromCache: true });
    expect(screen.getByText('正在載入詳解…')).toBeInTheDocument();
    expect(screen.queryByText('目前尚無詳解。')).not.toBeInTheDocument();

    // The server's answer has none for this question either.
    answerPaper([sharedPost]);
    expect(screen.getByText('目前尚無詳解。')).toBeInTheDocument();
    expect(screen.queryByText('正在載入詳解…')).not.toBeInTheDocument();
  });

  it("shows the question's posts from the paper's cached answer at once", () => {
    render(page());
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));
    answerPaper([sharedPost], { fromCache: true });

    expect(screen.getByText('共享的詳解')).toBeInTheDocument();
    expect(screen.queryByText('正在載入詳解…')).not.toBeInTheDocument();
  });

  it('reads replies, likes and reports once 討論區 opens, until another question is shown', () => {
    const view = render(page());
    answerPaper([sharedPost, secondPost]);
    expect(activeReactionPaths()).toEqual([]);

    openTab(/討論區/);
    expect(activeReactionPaths()).toEqual([
      'discussionPosts/post-1/replies',
      'discussionPosts/post-1/likes',
      'discussionPosts/post-1/reports/reader-1',
    ]);
    act(() =>
      listeners
        .findLast(
          (listener) =>
            listener.active && listener.path === 'discussionPosts/post-1/likes',
        )!
        .next({ size: 2, docs: [{ id: 'reader-1' }, { id: 'reader-2' }] }),
    );
    expect(screen.getByRole('button', { name: '讚 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Each listener opened again costs a read, so flipping tabs keeps the same ones.
    const opened = listeners.length;
    openTab(/^題目$/);
    openTab(/討論區/);
    expect(listeners).toHaveLength(opened);
    expect(activeReactionPaths()).toHaveLength(3);
    expect(screen.getByRole('button', { name: '讚 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Another question, on 題目: none, and none for the first one either when it is back.
    openTab(/^題目$/);
    router.query = { slug: examsSlug('law-114-02') };
    view.rerender(page());
    expect(activeReactionPaths()).toEqual([]);
    router.query = { slug: examsSlug('law-114-01') };
    view.rerender(page());
    expect(activeReactionPaths()).toEqual([]);
    expect(postListeners()).toEqual([paperListener()]);
  });

  it("shows the paper's read failure in 討論區 instead of an endless wait", () => {
    router.query = { slug: examsSlug('law-114-01'), tab: 'discussion' };
    render(page());
    act(() => paperListener().error(new Error('resource-exhausted')));

    expect(screen.getByRole('alert')).toHaveTextContent(readFailure);
    expect(screen.queryByText('正在載入共享投稿…')).not.toBeInTheDocument();
  });

  it("waits for the paper's new read back from its overview, without the old failure", () => {
    router.query = { slug: examsSlug('law-114-01'), tab: 'discussion' };
    const view = render(page());
    act(() => paperListener().error(new Error('resource-exhausted')));
    expect(screen.getByRole('alert')).toHaveTextContent(readFailure);

    router.query = { slug: ['law', '114'] };
    view.rerender(page());
    expect(postListeners().filter((listener) => listener.active)).toEqual([]);

    router.query = { slug: examsSlug('law-114-01'), tab: 'discussion' };
    view.rerender(page());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('正在載入共享投稿…')).toBeInTheDocument();

    answerPaper([sharedPost]);
    expect(screen.queryByText('正在載入共享投稿…')).not.toBeInTheDocument();
    expect(screen.getByText('共享的詳解')).toBeInTheDocument();
  });
});
