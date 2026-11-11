import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncProvider, useCloudSync } from '@/components/cloud-sync-provider';

const PENDING_KEY = 'shaneweb:sign-in-pending';

const mocks = vi.hoisted(() => ({
  reportUser: true,
  authCallback: null as null | ((user: unknown) => void),
  getRedirectResult: vi.fn(),
  signInWithRedirect: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({
  firebaseConfigurationAvailable: () => true,
  getFirebaseServices: () => ({ auth: {}, db: {} }),
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  getRedirectResult: mocks.getRedirectResult,
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    mocks.authCallback = callback;
    // Firebase answers once it has read its storage, never during the subscription.
    if (mocks.reportUser) void Promise.resolve().then(() => callback(null));
    return () => {};
  },
  signInWithRedirect: mocks.signInWithRedirect,
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));
vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: {
      attempts: [],
      notes: {},
      noteUpdatedAt: {},
      difficultQuestionIds: [],
      difficultPendingChanges: {},
      deletedAttemptIds: [],
    },
    dispatch: vi.fn(),
    hydrated: true,
  }),
}));

function Probe() {
  const cloud = useCloudSync();
  return (
    <>
      <output aria-label="cloud status">{cloud.status}</output>
      <output aria-label="cloud error">{cloud.error}</output>
      <button type="button" onClick={() => void cloud.signIn()}>
        跨裝置同步
      </button>
    </>
  );
}

function mount() {
  render(
    <CloudSyncProvider>
      <Probe />
    </CloudSyncProvider>,
  );
}

const status = () => screen.getByLabelText('cloud status');
const error = () => screen.getByLabelText('cloud error');

function pageshow(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  return event;
}

async function signedOut() {
  mount();
  await waitFor(() => expect(status()).toHaveTextContent('signed-out'));
}

describe('signing in with Google', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.reportUser = true;
    mocks.authCallback = null;
    mocks.getRedirectResult.mockReset().mockResolvedValue(null);
    // The page leaves for Google, so the call never comes back.
    mocks.signInWithRedirect.mockReset().mockReturnValue(new Promise(() => {}));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  });

  it('sends the whole page to Google instead of opening a popup', async () => {
    await signedOut();
    fireEvent.click(screen.getByRole('button', { name: '跨裝置同步' }));
    expect(mocks.signInWithRedirect).toHaveBeenCalledOnce();
    expect(status()).toHaveTextContent('syncing');
    expect(sessionStorage.getItem(PENDING_KEY)).toBe('1');
  });

  it('signs in from an iPhone Home Screen web app too', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1',
    );
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    await signedOut();
    fireEvent.click(screen.getByRole('button', { name: '跨裝置同步' }));
    expect(mocks.signInWithRedirect).toHaveBeenCalledOnce();
    expect(error()).toBeEmptyDOMElement();
  });

  it('explains why the page could not leave for Google', async () => {
    mocks.signInWithRedirect.mockRejectedValue({ code: 'auth/network-request-failed' });
    await signedOut();
    fireEvent.click(screen.getByRole('button', { name: '跨裝置同步' }));
    await waitFor(() => expect(error()).toHaveTextContent('請檢查網路後重試'));
    expect(status()).toHaveTextContent('signed-out');
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('says 登入中 on the way back until Firebase reports the user', async () => {
    sessionStorage.setItem(PENDING_KEY, '1');
    mocks.reportUser = false;
    mount();
    await waitFor(() => expect(status()).toHaveTextContent('syncing'));
    act(() => mocks.authCallback?.(null));
    expect(status()).toHaveTextContent('signed-out');
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('explains a trip to Google that came back without a user', async () => {
    mocks.getRedirectResult.mockRejectedValue({ code: 'auth/unauthorized-domain' });
    await signedOut();
    await waitFor(() => expect(error()).toHaveTextContent('Authorized domains'));
    expect(status()).toHaveTextContent('signed-out');
  });

  it('goes back to 跨裝置同步 when the browser restores the page left for Google', async () => {
    await signedOut();
    fireEvent.click(screen.getByRole('button', { name: '跨裝置同步' }));
    act(() => {
      window.dispatchEvent(pageshow(false));
    });
    expect(status()).toHaveTextContent('syncing');
    act(() => {
      window.dispatchEvent(pageshow(true));
    });
    expect(status()).toHaveTextContent('signed-out');
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });
});
