import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { THEME_COLORS_STORAGE_KEY } from '@/lib/theme';
import AppearancePage from '@/pages/appearance';
import {
  customDarkPalette,
  customLightPalette,
  failLocalStorageWrites,
  storedThemeColors,
} from '../../fixtures/shell';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 介面配色設定（/appearance，頂部列顯示「設定」）：選擇要編輯的模式、本站官方配色、
 * 進階設定（六個色碼與可讀性檢查）與頁面預覽。設定頁的「介面配色設定」區塊也是這個畫面。
 * 一開始編輯網站目前的模式，工具列的「主題」切到深色就是編輯深色配色、列出深色的官方配色。
 *
 * 畫面上可以操作看到：
 * - 點另一個模式：網站模式不變，只換成編輯與預覽那個模式。
 * - 點官方配色：只更新下方預覽；按「套用此模式」後網站換色、跳出通知，色票標示「使用中」
 *   （另一個模式的配色是「已儲存」，切到那個模式時才套用，色票標示「已設定」）。
 * - 展開「進階設定」改色碼：格式不完整時不能套用；文字與背景太接近時列出對比不足的組合。
 * - 有自訂配色時按「載入預設色」放進預覽，再按「套用此模式」恢復預設配色。
 */
const meta = {
  title: 'Layouts/設定/介面配色畫面',
  component: AppearancePage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/appearance') },
} satisfies Meta<typeof AppearancePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 全新使用者：淺色是預設的「米紙方格」，深色是「墨紙方格」。 */
export const 預設配色: Story = {};

/** 兩個模式都存了不屬於官方配色的自訂色：網站整體換色，模式卡片顯示「自訂配色」。 */
export const 自訂配色: Story = {
  parameters: {
    localStorage: storedThemeColors({
      light: customLightPalette,
      dark: customDarkPalette,
    }),
  },
};

/**
 * 配色存不進瀏覽器（空間已滿）：選一組官方配色後按「套用此模式」，本次瀏覽仍會換色，
 * 頁面上方出現警告，展開的「進階設定」下方也說明沒有存檔。
 */
export const 配色無法保存: Story = {
  beforeEach: failLocalStorageWrites('quota-exceeded', [THEME_COLORS_STORAGE_KEY]),
};
