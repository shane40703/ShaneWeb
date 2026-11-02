import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncProvider, useCloudSync } from '@/components/cloud-sync-provider';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import { AppStateProvider, useAppState } from '@/state/app-state';

const mocks = vi.hoisted(() => ({
  serverIds: [] as string[],
  initial: Promise.resolve({ exists: () => false, data: () => ({}) }) as Promise<{ exists: () => boolean; data: () => object }>,
  hold: null as Promise<void> | null,
  listener: null as null | ((snapshot: unknown) => void),
  runTransaction: vi.fn(),
  getDoc: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  getFirebaseServices: () => ({ auth: {}, db: {} }),
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback({ uid: 'test-user' });
    return () => {};
  },
  signInWithPopup: mocks.signInWithPopup, signInWithRedirect: vi.fn(), signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDoc: mocks.getDoc,
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: () => ({}),
  runTransaction: mocks.runTransaction,
  onSnapshot: (ref: { path: string }, callback: (snapshot: unknown) => void) => {
    if (ref.path.endsWith('/settings/difficult')) {
      mocks.listener = callback;
      callback({ exists: () => true, metadata: { fromCache: false }, data: () => ({ questionIds: [...mocks.serverIds] }) });
    }
    return () => {};
  },
}));
vi.mock('@/lib/note-image-storage', () => ({
  readStoredNoteImages: async () => null,
  writeStoredNoteImages: async () => {},
  stateWithoutNoteImages: (state: object) => state,
}));

function Probe() {
  const { state, dispatch, hydrated } = useAppState();
  const { status, error, signIn } = useCloudSync();
  return <>
    <output data-testid="marks">{JSON.stringify(state.difficultQuestionIds)}</output>
    <output data-testid="pending">{JSON.stringify(state.difficultPendingChanges)}</output>
    <output data-testid="cloud">{status}</output>
    <output data-testid="cloud-error">{error}</output>
    <button onClick={() => void signIn()}>sign in</button>
    <button disabled={!hydrated} onClick={() => dispatch({ type: 'toggle-difficult', questionId: 'law-114-01' })}>
      toggle mark
    </button>
  </>;
}

function mount() {
  return render(<AppStateProvider><CloudSyncProvider><Probe /></CloudSyncProvider></AppStateProvider>);
}

beforeEach(() => {
  localStorage.clear();
  mocks.serverIds = [];
  mocks.listener = null;
  mocks.hold = null;
  mocks.getDoc.mockReset();
  mocks.runTransaction.mockReset();
  mocks.getDoc.mockImplementation(() => mocks.initial);
  mocks.runTransaction.mockImplementation(async (_db, callback) => {
    if (mocks.hold) await mocks.hold;
    let written: string[] | null = null;
    const transaction = {
      get: async () => ({ exists: () => true, data: () => ({ questionIds: [...mocks.serverIds] }) }),
      set: (_ref: unknown, data: { questionIds: string[] }) => { written = data.questionIds; },
    };
    await callback(transaction);
    if (written) mocks.serverIds = written;
    mocks.listener?.({ exists: () => true, metadata: { fromCache: false }, data: () => ({ questionIds: [...mocks.serverIds] }) });
  });
});
afterEach(cleanup);

describe('signing in from an iPhone Home Screen web app', () => {
  beforeEach(() => {
    mocks.signInWithPopup.mockReset();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    );
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  });

  it('shows an error instead of opening a popup that can never report back', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'sign in' }));
    await waitFor(() => expect(screen.getByTestId('cloud-error')).toHaveTextContent(
      '從主畫面的網頁 App 無法登入。請用 Safari 打開本站再登入。',
    ));
    expect(mocks.signInWithPopup).not.toHaveBeenCalled();
  });

  it('still opens the popup in the browser', async () => {
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'sign in' }));
    await waitFor(() => expect(mocks.signInWithPopup).toHaveBeenCalledOnce());
  });
});

describe('difficult mark cloud synchronization', () => {
  it('keeps marks made while an older initial cloud list is still loading', async () => {
    const old = createDefaultState();
    old.difficultQuestionIds = ['law-113-01'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    let resolveInitial!: (snapshot: { exists: () => boolean; data: () => object }) => void;
    mocks.initial = new Promise(resolve => { resolveInitial = resolve; });
    mocks.serverIds = ['env-113-02', 'construction-113-01'];
    mount();
    await waitFor(() => expect(mocks.getDoc).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'toggle mark' }));
    expect(screen.getByTestId('marks')).toHaveTextContent('law-114-01');
    await act(async () => resolveInitial({ exists: () => true, data: () => ({ questionIds: ['env-113-02'] }) }));
    await waitFor(() => expect(mocks.serverIds).toEqual([
      'construction-113-01', 'env-113-02', 'law-113-01', 'law-114-01',
    ]));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('{}'));
    expect(screen.getByTestId('marks')).toHaveTextContent('law-114-01');
    expect(screen.getByTestId('marks')).toHaveTextContent('law-113-01');
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.difficultQuestionIds).toContain('law-114-01');
      expect(saved.difficultQuestionIds).toContain('law-113-01');
      expect(saved.difficultPendingChanges).toEqual({});
    });
  });

  it('sends a later unmark after an earlier mark transaction completes', async () => {
    mocks.initial = Promise.resolve({ exists: () => true, data: () => ({ questionIds: [] }) });
    let release!: () => void;
    mocks.hold = new Promise<void>(resolve => { release = resolve; });
    mount();
    await waitFor(() => expect(mocks.listener).not.toBeNull());
    const toggle = await screen.findByRole('button', { name: 'toggle mark' });
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.runTransaction).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    expect(screen.getByTestId('pending')).toHaveTextContent('"law-114-01":false');
    mocks.hold = null;
    await act(async () => release());
    await waitFor(() => expect(mocks.runTransaction).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('{}'));
    expect(mocks.serverIds).toEqual([]);
    expect(screen.getByTestId('marks')).toHaveTextContent('[]');
  });

  it('keeps an offline mark locally and retries it when the connection returns', async () => {
    mocks.initial = Promise.resolve({ exists: () => true, data: () => ({ questionIds: [] }) });
    mocks.runTransaction.mockRejectedValueOnce(new Error('offline'));
    mount();
    await waitFor(() => expect(mocks.listener).not.toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'toggle mark' }));
    await screen.findByText('error');
    expect(screen.getByTestId('pending')).toHaveTextContent('"law-114-01":true');
    expect(screen.getByTestId('marks')).toHaveTextContent('law-114-01');
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mocks.serverIds).toEqual(['law-114-01']));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('{}'));
  });

  it('retries initial synchronization after an offline startup', async () => {
    mocks.initial = Promise.resolve({ exists: () => true, data: () => ({ questionIds: [] }) });
    mocks.getDoc.mockRejectedValueOnce(new Error('offline'));
    mount();
    await screen.findByText('error');
    fireEvent.click(await screen.findByRole('button', { name: 'toggle mark' }));
    expect(screen.getByTestId('pending')).toHaveTextContent('"law-114-01":true');
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mocks.serverIds).toEqual(['law-114-01']));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('{}'));
  });

  it('retries when connectivity returns before the in-flight transaction fails', async () => {
    mocks.initial = Promise.resolve({ exists: () => true, data: () => ({ questionIds: [] }) });
    let fail!: () => void;
    mocks.runTransaction.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      fail = () => reject(new Error('offline'));
    }));
    mount();
    await waitFor(() => expect(mocks.listener).not.toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'toggle mark' }));
    await waitFor(() => expect(mocks.runTransaction).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event('online')));
    await act(async () => fail());
    await waitFor(() => expect(mocks.serverIds).toEqual(['law-114-01']));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('{}'));
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite a malformed cloud list or discard existing local marks', async () => {
    const old = createDefaultState();
    old.difficultQuestionIds = ['law-113-01'];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    mocks.initial = Promise.resolve({ exists: () => true, data: () => ({ questionIds: 'invalid' }) });
    mount();
    await screen.findByText('error');
    expect(screen.getByTestId('marks')).toHaveTextContent('law-113-01');
    fireEvent.click(await screen.findByRole('button', { name: 'toggle mark' }));
    expect(screen.getByTestId('pending')).toHaveTextContent('"law-114-01":true');
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});
