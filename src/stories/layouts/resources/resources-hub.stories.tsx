import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ResourcesOverview } from '@/features/resources/resources-overview';
import { ResourcesPage } from '@/features/resources/resources-page';
import {
  emptyResourcesOverview,
  resourcesOverview,
  singleYearResourcesOverview,
} from '../../fixtures/resources';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/** Controls 的 overview 選單：照 getStaticProps 用不同題庫與圖庫算出的統計。 */
const overviews = {
  範例資料: resourcesOverview,
  只有一個年度: singleYearResourcesOverview,
  尚無資料: emptyResourcesOverview,
};

/** 選單存的是選項名稱，Storybook 畫故事前才照 mapping 換成統計。 */
function overviewChoice(name: keyof typeof overviews) {
  return name as unknown as ResourcesOverview;
}

/**
 * 統計分析總覽（/resources）：考題分析、速記圖庫、法規資料庫三張卡片。
 * 統計數字照 getStaticProps 用範例題庫計算，所以比實際網站少；
 * 速記圖庫的縮圖是網站實際的整理圖。卡片會換到其他頁，在故事裡只記錄在 Actions 面板。
 *
 * Controls 的 overview 可以切換：
 * - 「只有一個年度」：題庫只有 113 年時，年度範圍只顯示一個年份。
 * - 「尚無資料」：題庫、整理圖、法規都還沒有資料，卡片改顯示「準備中」的說明。
 */
const meta = {
  title: 'Layouts/統計分析/總覽',
  component: ResourcesPage,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/resources') },
  args: { overview: overviewChoice('範例資料') },
  argTypes: {
    overview: {
      options: Object.keys(overviews),
      mapping: overviews,
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof ResourcesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 範例資料: Story = {};
