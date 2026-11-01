import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PrivacyRoute from '@/pages/privacy';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 隱私權政策（/privacy）。一張面板裡用虛線分段的純文字頁面，從側欄最下方進來，
 * 內容不隨登入狀態或資料變化。
 *
 * 畫面上可以操作看到：兩個 Google 的外部連結開新分頁，「問題回報」回到站內的回報表單。
 */
const meta = {
  title: 'Layouts/隱私權政策/政策內容',
  component: PrivacyRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/privacy') },
} satisfies Meta<typeof PrivacyRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 政策內容: Story = {};
