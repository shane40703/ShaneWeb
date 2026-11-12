import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizAttempt } from '@/lib/types';
import { CloudSyncCard } from './cloud-sync-card';

type CloudStatus = 'disabled' | 'signed-out' | 'syncing' | 'pending' | 'synced' | 'error';

const mocks = vi.hoisted(() => ({
  cloud: {
    user: null as User | null,
    status: 'signed-out' as CloudStatus,
    error: '',
    progressConflicts: [] as { id: string; localUpdatedAt: number; remoteUpdatedAt: number }[],
    syncProgressNow: vi.fn(),
    resolveProgressConflict: vi.fn(),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  },
  state: {
    attempts: [] as QuizAttempt[],
    notes: {} as Record<string, string>,
    noteImages: {} as Record<string, unknown[]>,
    difficultQuestionIds: [] as string[],
  },
}));

vi.mock('@/components/cloud-sync-provider', () => ({ useCloudSync: () => mocks.cloud }));
vi.mock('@/state/app-state', () => ({ useAppState: () => ({ state: mocks.state }) }));

const signedInUser = {
  uid: 'user-1',
  displayName: '林建築',
  email: 'lin@example.com',
} as User;

function setCloud(cloud: Partial<typeof mocks.cloud>) {
  Object.assign(mocks.cloud, cloud);
}

async function openCard(name: string) {
  const user = userEvent.setup();
  render(<CloudSyncCard />);
  await user.click(screen.getByRole('button', { name }));
  const card = await screen.findByRole('dialog', { name: '跨裝置同步' });
  return { user, card };
}

beforeEach(() => {
  setCloud({ user: null, status: 'signed-out', error: '', progressConflicts: [] });
  mocks.cloud.signIn.mockClear();
  mocks.cloud.signOut.mockClear();
  mocks.cloud.syncProgressNow.mockClear();
  mocks.cloud.resolveProgressConflict.mockClear();
  mocks.state.attempts = [{ id: 'one' }, { id: 'two' }] as QuizAttempt[];
  mocks.state.notes = { 'law-114-01': '筆記' };
  mocks.state.noteImages = {};
  mocks.state.difficultQuestionIds = [];
});
afterEach(cleanup);

describe('CloudSyncCard signed out', () => {
  it('opens the explanation card instead of leaving for Google', async () => {
    const { card } = await openCard('跨裝置同步');

    expect(card).toHaveTextContent(
      '用 Google 帳號登入，手機、平板和電腦看到同一份紀錄。',
    );
    expect(card).toHaveTextContent('這台裝置有 3 筆紀錄，目前只存在這個瀏覽器。');
    expect(
      within(card).getByRole('heading', { name: '登入後會同步' }),
    ).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '作答紀錄，以及做到一半的每日抽題和模擬考',
      '文字筆記和難題標記',
      '字級和配色',
    ]);
    expect(card).toHaveTextContent('不包含筆記圖片和法規克漏字。');
    expect(card).toHaveTextContent('不登入也能照常練習，紀錄會留在這個瀏覽器。');
    expect(mocks.cloud.signIn).not.toHaveBeenCalled();
  });

  it('leaves for Google only from 用 Google 登入', async () => {
    const { user, card } = await openCard('跨裝置同步');

    await user.click(within(card).getByRole('button', { name: '用 Google 登入' }));

    expect(mocks.cloud.signIn).toHaveBeenCalledOnce();
  });

  it('closes on 先留在本機 and changes nothing', async () => {
    const { user, card } = await openCard('跨裝置同步');

    await user.click(within(card).getByRole('button', { name: '先留在本機' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.cloud.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '跨裝置同步' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes on Escape', async () => {
    const { user } = await openCard('跨裝置同步');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.cloud.signIn).not.toHaveBeenCalled();
  });

  it('closes on a press outside the card', async () => {
    const { user } = await openCard('跨裝置同步');

    await user.click(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('says so when nothing is saved yet', async () => {
    mocks.state.attempts = [];
    mocks.state.notes = { 'law-114-01': '  ' };
    const { card } = await openCard('跨裝置同步');

    expect(card).toHaveTextContent('目前還沒有保存的紀錄。');
    expect(card).not.toHaveTextContent('筆紀錄');
  });

  it('shows 登入中 while the page is leaving for Google', async () => {
    setCloud({ status: 'syncing' });
    const { card } = await openCard('登入中');

    const signIn = within(card).getByRole('button', { name: '登入中' });
    expect(signIn).toBeDisabled();
    expect(within(card).queryByRole('button', { name: '用 Google 登入' })).toBeNull();
    expect(within(card).getByRole('button', { name: '先留在本機' })).toBeEnabled();
  });

  it('shows a sign-in error under the button while shut, and inside the card once opened', async () => {
    setCloud({ status: 'signed-out', error: 'Google 登入未完成，請稍後重試。' });
    const user = userEvent.setup();
    render(<CloudSyncCard />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Google 登入未完成，請稍後重試。',
    );

    await user.click(screen.getByRole('button', { name: '跨裝置同步' }));
    const card = await screen.findByRole('dialog', { name: '跨裝置同步' });
    await act(async () => {});

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(card).toContainElement(alerts[0]);
    expect(alerts[0]).toHaveTextContent('Google 登入未完成，請稍後重試。');
  });

  it('brings the box back after the card shuts, without reading the error out again', async () => {
    setCloud({ status: 'signed-out', error: 'Google 登入未完成，請稍後重試。' });
    const { user } = await openCard('跨裝置同步');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.getByText('Google 登入未完成，請稍後重試。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows nothing when the site has no cloud', () => {
    setCloud({ status: 'disabled' });
    render(<CloudSyncCard />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('CloudSyncCard signed in', () => {
  beforeEach(() => setCloud({ user: signedInUser, status: 'synced' }));

  it('opens the account card instead of signing out', async () => {
    const { card } = await openCard('林建築，已同步');

    expect(mocks.cloud.signOut).not.toHaveBeenCalled();
    expect(card).toHaveTextContent('林建築');
    expect(card).toHaveTextContent('lin@example.com');
    expect(card).toHaveTextContent('已同步');
    expect(within(card).getByRole('heading', { name: '同步的內容' })).toBeInTheDocument();
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
    expect(card).toHaveTextContent(
      '登出後，這台裝置的紀錄仍會留在這個瀏覽器，只是不再和其他裝置同步。',
    );
    expect(within(card).queryByRole('alert')).toBeNull();
  });

  it('signs out from 登出 and closes the card', async () => {
    const { user, card } = await openCard('林建築，已同步');

    await user.click(within(card).getByRole('button', { name: '登出' }));

    expect(mocks.cloud.signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('names the trigger 已登入 when Google gives no name, and leaves out a missing email', async () => {
    setCloud({ user: { uid: 'user-2', displayName: null, email: null } as User });
    const { card } = await openCard('已登入，已同步');

    expect(within(card).getByText('已登入')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('@');
  });

  it('shows 同步中 while syncing', async () => {
    setCloud({ status: 'syncing' });
    const { card } = await openCard('林建築，同步中');

    expect(screen.getByRole('button', { name: '林建築，同步中' })).toHaveTextContent(
      '同步中',
    );
    expect(card).toHaveTextContent('同步中');
    expect(within(card).queryByRole('alert')).toBeNull();
  });

  it('explains pending progress and lets the user sync it before switching devices', async () => {
    setCloud({ status: 'pending' });
    const { user, card } = await openCard('林建築，作答進度待同步');
    expect(card).toHaveTextContent('作答進度先保存在本機');
    await user.click(within(card).getByRole('button', { name: '立即同步作答進度' }));
    expect(mocks.cloud.syncProgressNow).toHaveBeenCalledOnce();
  });

  it('asks which progress to retain when devices conflict', async () => {
    setCloud({ status: 'error', error: '本機與雲端都有不同進度，請選擇要保留哪一份。',
      progressConflicts: [{ id: 'practice', localUpdatedAt: 1000, remoteUpdatedAt: 2000 }] });
    const { user, card } = await openCard('林建築，作答進度衝突');
    expect(card).toHaveTextContent('選擇後另一份進度會被取代');
    expect(within(card).getByRole('button', { name: '立即同步作答進度' })).toBeDisabled();
    await user.click(within(card).getByRole('button', { name: '保留本機進度' }));
    expect(mocks.cloud.resolveProgressConflict).toHaveBeenCalledWith('practice', 'local');
  });

  it('reports a failed sync with its reason inside the card', async () => {
    setCloud({ status: 'error', error: '無法連線到雲端，最新的紀錄還沒有同步。' });
    const { card } = await openCard('林建築，同步失敗');

    const alert = within(card).getByRole('alert');
    expect(alert).toHaveTextContent('同步失敗');
    expect(alert).toHaveTextContent('無法連線到雲端，最新的紀錄還沒有同步。');
    // A signed-in user's error stays in the card, never in a box under the button.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('leaves out an old error once a later sync went through', async () => {
    setCloud({
      status: 'synced',
      error: '最新作答仍保存在本機，恢復連線後請重新登入同步。',
    });
    const { card } = await openCard('林建築，已同步');

    expect(card).toHaveTextContent('已同步');
    expect(card).not.toHaveTextContent('最新作答仍保存在本機');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
