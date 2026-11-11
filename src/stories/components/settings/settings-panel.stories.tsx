import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SettingsPanel } from '@/features/settings/settings-panel';

/**
 * 設定頁與設定視窗共用的內容：閱讀設定、介面配色設定兩個可收合的區塊，預設都收起來，
 * 最下面是連到開源授權頁的「開源授權」（整列是連結，右邊是箭頭，不是展開的三角形）。
 *
 * 畫面上可以操作看到：點「閱讀設定」展開字級滑桿與預覽，拖動滑桿預覽文字跟著變大變小
 * （14～24px）；點「介面配色設定」展開模式選擇、官方配色、進階設定與頁面預覽。
 * 在設定視窗裡點「開源授權」會換頁並關閉視窗（`Layouts/網站外框/側欄與頂部列`）。
 */
const meta = {
  title: 'Components/設定/SettingsPanel',
  component: SettingsPanel,
} satisfies Meta<typeof SettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
