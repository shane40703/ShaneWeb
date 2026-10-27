import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PracticeHubPage } from '@/features/practice/practice-hub-page';
import { practiceOverview } from '../../fixtures/practice';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 每日練習總覽（/practice）：每日抽題練習、歷屆試題模擬考、法規克漏字三張大型卡片。
 * 每張卡片說明抽題／模擬考方式與適合對象；長說明會隨卡片寬度換行。
 * 桌機使用整頁寬度橫排三欄；容器不足 900px 時直排，手機不會橫向溢出。統計數字照
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
