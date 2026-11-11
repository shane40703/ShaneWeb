import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CommunityPage } from '@/features/community/community-page';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 側欄的「LINE 社群」（/line）與「Threads」（/threads）各是一頁，取代問題回報表單，不需要登入；
 * 舊的社群連結（/community）與問題回報（/report）網址都轉到 LINE 社群。
 * 每頁一張卡片：說明、另開新分頁的按鈕與 QR Code。QR Code 是本機靜態資產（public/social），
 * 不呼叫外部產碼服務。
 * 使用工具列切換深淺主題與手機寬度；窄版時 QR Code 移到文字下方、按鈕滿寬。
 * 區塊文字不可拖曳反白，連結仍可正常操作。
 */
const meta = {
  title: 'Layouts/社群',
  component: CommunityPage,
  decorators: [withPageFrame],
} satisfies Meta<typeof CommunityPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LINE社群: Story = {
  args: { channel: 'line' },
  parameters: { ...pageParameters('/line') },
};

export const Threads: Story = {
  args: { channel: 'threads' },
  parameters: { ...pageParameters('/threads') },
};
