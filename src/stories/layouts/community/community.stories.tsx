import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CommunityPage } from '@/features/community/community-page';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 社群連結（/community）：取代問題回報表單，不需要登入。
 * 上面是 Threads，下面是 LINE 開源社群；兩張卡片的按鈕與 QR Code 都另開新分頁，
 * QR Code 是本機靜態資產（public/social），不呼叫外部產碼服務。
 * 使用工具列切換深淺主題與手機寬度；窄版時 QR Code 移到文字下方、按鈕滿寬。
 * 區塊文字不可拖曳反白，連結仍可正常操作。
 */
const meta = {
  title: 'Layouts/社群連結/總覽',
  component: CommunityPage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/community') },
} satisfies Meta<typeof CommunityPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Threads與LINE社群: Story = {};
