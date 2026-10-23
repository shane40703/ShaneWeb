import type { User } from 'firebase/auth';
import { fn, mocked } from 'storybook/test';
import { useCloudSync, useOptionalCloudSync } from '@/components/cloud-sync-provider';
import { firebaseConfigurationAvailable } from '@/lib/firebase-client';

/**
 * 工具列「雲端同步」的選項。Storybook 不會連到 Firebase；選了雲端狀態時，只是讓畫面
 * 以為網站有設定 Firebase、使用者在這個登入狀態，看正式網站頂部列與問題回報的樣子。
 * 共享投稿在雲端狀態下會一直顯示載入中（沒有真的去讀）。
 */
export const cloudModes = {
  local: '未設定雲端（本機保存）',
  'signed-out': '雲端：未登入',
  'signing-in': '雲端：登入中',
  'signed-in': '雲端：已登入',
  syncing: '雲端：同步中',
  error: '雲端：登入失敗',
} as const;

export type CloudMode = keyof typeof cloudModes;

const storyUser = {
  uid: 'story-user',
  displayName: '林建築',
  email: 'story-user@example.com',
} as User;

function cloudValue(mode: Exclude<CloudMode, 'local'>) {
  const signedIn = mode === 'signed-in' || mode === 'syncing';
  return {
    user: signedIn ? storyUser : null,
    status:
      mode === 'signed-in'
        ? ('synced' as const)
        : mode === 'signing-in' || mode === 'syncing'
          ? ('syncing' as const)
          : mode === 'error'
            ? ('error' as const)
            : ('signed-out' as const),
    error: mode === 'error' ? 'Google 登入視窗已關閉，尚未完成登入。' : '',
    signIn: fn(async () => undefined).mockName('cloud.signIn'),
    signOut: fn(async () => undefined).mockName('cloud.signOut'),
  };
}

/** 在畫故事之前呼叫：依「雲端同步」的選項換掉網站讀取登入狀態的地方。 */
export function applyCloudMode(mode: CloudMode) {
  if (mode === 'local') {
    mocked(useCloudSync).mockReset();
    mocked(useOptionalCloudSync).mockReset();
    mocked(firebaseConfigurationAvailable).mockReset();
    return;
  }
  const value = cloudValue(mode);
  mocked(useCloudSync).mockReturnValue(value);
  mocked(useOptionalCloudSync).mockReturnValue(value);
  mocked(firebaseConfigurationAvailable).mockReturnValue(true);
}

export function isCloudMode(value: unknown): value is CloudMode {
  return typeof value === 'string' && value in cloudModes;
}
