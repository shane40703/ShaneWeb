import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import shellStyles from '@/components/layout/app-shell.module.css';
import { CloudSyncCard } from '@/components/layout/cloud-sync-card';
import {
  attemptsAppState,
  notesAppState,
  personalAttempts,
  personalDifficultIds,
} from '../../fixtures/personal';

/** 跟網站一樣放在頂部列的右邊，下面留出卡片打開的空間。 */
const inTopbar: Decorator = (Story) => (
  <div style={{ minHeight: 640 }}>
    <header className={shellStyles.topbar}>
      <div className={shellStyles.topbarLeft} />
      <div className={shellStyles.topbarActions}>
        <Story />
      </div>
    </header>
  </div>
);

/** 有作答紀錄、筆記與難題標記的本機資料，卡上會寫出這台裝置有幾筆紀錄。 */
const savedRecords = {
  ...attemptsAppState(personalAttempts),
  ...notesAppState,
  difficultQuestionIds: personalDifficultIds,
};

/**
 * 頂部列右上角的雲端按鈕與「跨裝置同步」卡。網站有設定雲端時才出現；沒有設定時頂部列是
 * 「免登入・本機保存」，不是這個按鈕。每個故事一打開就是卡片打開的樣子。
 *
 * - 未登入：按鈕是雲朵和「跨裝置同步」。卡上說明登入後會同步什麼、這台裝置現在有幾筆紀錄，
 *   按「用 Google 登入」才前往 Google（這裡只記在 Actions 面板）。
 * - 已登入：按鈕是使用者名稱。卡上是登入的帳號、同步狀態、同步的內容和「登出」。
 *
 * 畫面上可以操作看到：按「先留在本機」、按 Esc 或點卡片外面關上卡片，再按一次按鈕打開；
 * 登入失敗的故事關上卡片後，按鈕下方出現紅色的錯誤說明。視窗寬度切到手機，按鈕只剩
 * 圖示，卡片貼齊畫面左右各 16px。
 *
 * 每個故事固定了工具列的「雲端同步」，所以登入狀態各寫一個故事。
 */
const meta = {
  title: 'Components/網站外框/CloudSyncCard',
  component: CloudSyncCard,
  decorators: [inTopbar],
  parameters: { layout: 'fullscreen' },
  args: { defaultOpen: true },
} satisfies Meta<typeof CloudSyncCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 未登入有紀錄: Story = {
  name: '未登入（有紀錄）',
  globals: { cloud: 'signed-out' },
  parameters: { appState: savedRecords },
};

export const 未登入沒有紀錄: Story = {
  name: '未登入（沒有紀錄）',
  globals: { cloud: 'signed-out' },
};

/** 按了「用 Google 登入」、頁面正要前往 Google，或從 Google 回來還在等結果。 */
export const 登入中: Story = {
  globals: { cloud: 'signing-in' },
  parameters: { appState: savedRecords },
};

/** 登入沒有完成：錯誤說明在卡片的按鈕上方；關上卡片後改在頂部按鈕下方。 */
export const 登入失敗: Story = {
  globals: { cloud: 'error' },
  parameters: { appState: savedRecords },
};

export const 已登入: Story = {
  globals: { cloud: 'signed-in' },
};

export const 同步中: Story = {
  globals: { cloud: 'syncing' },
};

/** 已登入但最新的紀錄傳不上雲端：狀態列是紅色的「同步失敗」和原因。 */
export const 同步失敗: Story = {
  globals: { cloud: 'sync-error' },
};
