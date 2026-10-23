import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SettingsPage from '@/pages/settings';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 設定頁（/settings）：閱讀設定與介面配色設定兩個可收合的區塊，預設都收起來。
 * 在其他頁按側欄的「設定」是開啟設定視窗，內容一樣（`Layouts/網站外框/側欄與頂部列`）。
 *
 * 畫面上可以操作看到：點「閱讀設定」展開字級滑桿與預覽，拖動滑桿後預覽文字與整個網站的
 * 題目、選項字級跟著改變（14～24px）；點「介面配色設定」展開模式選擇、官方配色、進階設定
 * 與頁面預覽（各種操作見 `Layouts/設定/介面配色畫面`）。
 */
const meta = {
  title: 'Layouts/設定/設定畫面',
  component: SettingsPage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/settings') },
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
