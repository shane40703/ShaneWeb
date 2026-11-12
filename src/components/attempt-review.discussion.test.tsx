import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttemptReview } from '@/components/attempt-review';
import { ToastProvider } from '@/components/ui/ui';
import type { QuizAttempt } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';

type Constraint = { field: string; op: string; value: unknown };
type Listener = {
  path: string;
  constraints: Constraint[];
  options?: { includeMetadataChanges?: boolean };
  next: (snapshot: unknown) => void;
  error: (reason: unknown) => void;
  active: boolean;
};

// Every onSnapshot is recorded with its target, and the test decides when the server answers.
const firestore = vi.hoisted(() => ({ listeners: [] as Listener[] }));
// Signed in, so reading reactions would also open a report listener per post.
const cloud = vi.hoisted(() => ({
  value: { user: { uid: 'reader-1' }, signIn: async () => {} },
}));

vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  getFirebaseServices: () => ({ db: {}, auth: {} }),
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
      firestore.listeners.push(listener);
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

const options = ['選項 A', '選項 B', '選項 C', '選項 D'];
const questions = [
  {
    id: 'law-114-01',
    year: 114,
    questionNumber: 1,
    text: '第一題',
    options,
    answerKey: { kind: 'accepted' as const, options: [1] },
    explanation: '官方題目詳解',
  },
  {
    id: 'law-114-02',
    year: 114,
    questionNumber: 2,
    text: '第二題',
    options,
    answerKey: { kind: 'accepted' as const, options: [2] },
  },
  {
    id: 'law-114-03',
    year: 114,
    questionNumber: 3,
    text: '第三題',
    options,
    answerKey: { kind: 'accepted' as const, options: [0] },
    explanation: '第三題內建詳解',
  },
];

const attempt: QuizAttempt = {
  id: 'attempt-1',
  mode: 'paper',
  subject: 'law',
  year: 114,
  questionIds: questions.map((question) => question.id),
  answers: { 'law-114-01': 1, 'law-114-02': 0, 'law-114-03': 0 },
  startedAt: '2026-07-25T00:00:00.000Z',
  submittedAt: '2026-07-25T00:01:00.000Z',
  elapsedSeconds: 60,
  correctCount: 2,
  wrongCount: 1,
  unansweredCount: 0,
};

const readFailure = '無法讀取共享投稿，請確認 Firestore 規則與網路連線。';

function renderReview() {
  const view = render(
    <ToastProvider>
      <AppStateProvider>
        <AttemptReview attempt={attempt} questions={questions} />
      </AppStateProvider>
    </ToastProvider>,
  );
  return (questionId: string) =>
    within(
      view.container.querySelector<HTMLElement>(`[data-question-id="${questionId}"]`)!,
    );
}

const discussionListeners = () =>
  firestore.listeners.filter((listener) => listener.path.startsWith('discussionPosts'));

const postsTarget = (questionId: string) => ({
  path: 'discussionPosts',
  constraints: [{ field: 'questionId', op: '==', value: questionId }],
});

const postsListener = (questionId: string) =>
  discussionListeners().find(
    (listener) =>
      listener.path === 'discussionPosts' &&
      listener.constraints.some((constraint) => constraint.value === questionId),
  );

// The server answers unless `fromCache` says the device's cache answered on its own.
function answerPosts(
  questionId: string,
  posts: Array<{ id: string; content: string }>,
  { fromCache = false } = {},
) {
  act(() =>
    postsListener(questionId)!.next({
      size: posts.length,
      metadata: { fromCache, hasPendingWrites: false },
      docs: posts.map((post) => ({
        id: post.id,
        data: () => ({
          questionId,
          type: 'explanation',
          content: post.content,
          // One author per post: a second explanation by the same author is folded away.
          authorId: `author-of-${post.id}`,
          createdAt: { toDate: () => new Date('2026-11-01T00:00:00.000Z') },
        }),
      })),
    }),
  );
}

describe('AttemptReview discussion reads', () => {
  beforeEach(() => {
    firestore.listeners.length = 0;
  });
  afterEach(cleanup);

  it('lists every question without opening a discussion listener', () => {
    const row = renderReview();

    expect(
      row('law-114-03').getByRole('button', { name: '顯示詳解與討論' }),
    ).toBeVisible();
    expect(discussionListeners()).toEqual([]);
  });

  it('shows the built-in explanation and a loading status as soon as a row opens', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-01').getByRole('button', { name: '顯示詳解與討論' }));

    expect(row('law-114-01').getByText('官方題目詳解')).toBeInTheDocument();
    expect(row('law-114-01').getByRole('status')).toHaveTextContent(
      '正在載入詳解與討論…',
    );
    expect(row('law-114-01').queryByText('尚未有詳解或討論。')).not.toBeInTheDocument();
  });

  it('opens exactly one posts listener, for the opened question', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-01').getByRole('button', { name: '顯示詳解與討論' }));

    expect(discussionListeners()).toEqual([
      expect.objectContaining({ ...postsTarget('law-114-01'), active: true }),
    ]);
  });

  it('shows shared posts once read, without reading replies, likes or reports', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-01').getByRole('button', { name: '顯示詳解與討論' }));
    answerPosts('law-114-01', [{ id: 'post-1', content: '共享的解題筆記' }]);

    expect(row('law-114-01').getByText('共享的解題筆記')).toBeInTheDocument();
    expect(row('law-114-01').getByText('官方題目詳解')).toBeInTheDocument();
    expect(row('law-114-01').queryByRole('status')).not.toBeInTheDocument();
    expect(
      firestore.listeners.filter((listener) =>
        /\/(replies|likes|reports)(\/|$)/.test(listener.path),
      ),
    ).toEqual([]);
    expect(discussionListeners()).toHaveLength(1);
  });

  it('keeps the opened listener while collapsed, so reopening opens no new one', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-01').getByRole('button', { name: '顯示詳解與討論' }));
    answerPosts('law-114-01', [{ id: 'post-1', content: '共享的解題筆記' }]);

    fireEvent.click(row('law-114-01').getByRole('button', { name: '收合詳解與討論' }));
    expect(row('law-114-01').queryByText('共享的解題筆記')).not.toBeInTheDocument();
    expect(row('law-114-01').queryByText('官方題目詳解')).not.toBeInTheDocument();

    fireEvent.click(row('law-114-01').getByRole('button', { name: '顯示詳解與討論' }));
    expect(row('law-114-01').getByText('共享的解題筆記')).toBeInTheDocument();
    expect(row('law-114-01').queryByRole('status')).not.toBeInTheDocument();
    expect(discussionListeners()).toEqual([
      expect.objectContaining({ ...postsTarget('law-114-01'), active: true }),
    ]);
  });

  it('says a row without explanation has no discussion only after its empty answer', () => {
    const row = renderReview();
    expect(postsListener('law-114-02')).toBeUndefined();

    fireEvent.click(row('law-114-02').getByRole('button', { name: '顯示詳解與討論' }));
    expect(postsListener('law-114-02')).toMatchObject(postsTarget('law-114-02'));
    expect(row('law-114-02').getByRole('status')).toHaveTextContent(
      '正在載入詳解與討論…',
    );
    expect(row('law-114-02').queryByText('尚未有詳解或討論。')).not.toBeInTheDocument();

    answerPosts('law-114-02', []);
    expect(row('law-114-02').getByText('尚未有詳解或討論。')).toBeInTheDocument();
    expect(row('law-114-02').queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not take an empty answer from the cache as no discussion', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-02').getByRole('button', { name: '顯示詳解與討論' }));
    // Without metadata changes, a server answer that matches the cache never arrives.
    expect(postsListener('law-114-02')!.options).toEqual({
      includeMetadataChanges: true,
    });

    // Read earlier in this tab, or offline: the cache answers first, perhaps out of date.
    answerPosts('law-114-02', [], { fromCache: true });
    expect(row('law-114-02').getByRole('status')).toHaveTextContent(
      '正在載入詳解與討論…',
    );
    expect(row('law-114-02').queryByText('尚未有詳解或討論。')).not.toBeInTheDocument();

    answerPosts('law-114-02', []);
    expect(row('law-114-02').getByText('尚未有詳解或討論。')).toBeInTheDocument();
    expect(row('law-114-02').queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows cached posts at once and keeps loading until the server answers', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-02').getByRole('button', { name: '顯示詳解與討論' }));

    answerPosts('law-114-02', [{ id: 'post-1', content: '先前讀到的筆記' }], {
      fromCache: true,
    });
    expect(row('law-114-02').getByText('先前讀到的筆記')).toBeInTheDocument();
    expect(row('law-114-02').getByRole('status')).toBeInTheDocument();

    answerPosts('law-114-02', [
      { id: 'post-1', content: '先前讀到的筆記' },
      { id: 'post-2', content: '後來分享的筆記' },
    ]);
    expect(row('law-114-02').getByText('先前讀到的筆記')).toBeInTheDocument();
    expect(row('law-114-02').getByText('後來分享的筆記')).toBeInTheDocument();
    expect(row('law-114-02').queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the built-in explanation beside a read failure', () => {
    const row = renderReview();
    fireEvent.click(row('law-114-03').getByRole('button', { name: '顯示詳解與討論' }));
    act(() => postsListener('law-114-03')!.error(new Error('permission-denied')));

    expect(row('law-114-03').getByRole('alert')).toHaveTextContent(readFailure);
    expect(row('law-114-03').getByText('第三題內建詳解')).toBeInTheDocument();
    expect(row('law-114-03').queryByText('尚未有詳解或討論。')).not.toBeInTheDocument();
  });
});
