import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PracticeHubPage } from '@/features/practice/practice-hub-page';
import { practiceOverview } from '../../fixtures/practice';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 每日練習總覽（/practice）：選擇題練習、法規克漏字、歷屆試題模擬考三張卡片。統計數字照
 * getStaticProps 用範例題庫計算，所以比實際網站少。卡片會換到其他頁，在故事裡只記錄在
 * Actions 面板。
 */
const meta = {
  title: 'Layouts/每日練習/總覽',
  component: PracticeHubPage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/practice') },
  args: { overview: practiceOverview },
} satisfies Meta<typeof PracticeHubPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
