import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CommunityPage } from '@/features/community/community-page';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 社群連結（/community）：取代問題回報表單，不需要登入。
 * Threads 按鈕與 QR Code 都能另開主頁；QR Code 是本機靜態資產，不呼叫外部產碼服務。
 * 使用工具列切換深淺主題與手機寬度；窄版時 QR Code 移到文字下方、前往按鈕滿寬。
 */
const meta = {
  title: 'Layouts/社群連結/總覽',
  component: CommunityPage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/community') },
} satisfies Meta<typeof CommunityPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Threads: Story = {};
