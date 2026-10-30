import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PersonalHubPage } from '@/features/personal/personal-hub-page';
import { FIXTURE_NOW } from '../../fixtures/app-state';
import { heatmapAppState } from '../../fixtures/personal';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 我的作答存摺總覽（/personal）：上方是過去一年的活動熱力圖，下方一列一個頁面（我的筆記、
 * 難題標記、常錯題目、每日練習履歷、歷屆試題作答履歷）。整列都能點，會換到其他頁，在故事裡
 * 只記錄在 Actions 面板。
 *
 * 工具列切到手機寬度時，頁面列的標題與說明改成上下排；放不下 53 週時熱力圖在面板內捲動，
 * 一打開停在最近幾週。
 */
const meta = {
  title: 'Layouts/我的作答存摺/總覽',
  component: PersonalHubPage,
  args: { today: FIXTURE_NOW.slice(0, 10) },
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/personal') },
} satisfies Meta<typeof PersonalHubPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一年份的作答紀錄。 */
export const 有作答紀錄: Story = {
  parameters: { ...pageParameters('/personal'), appState: heatmapAppState },
};

/** 沒有作答紀錄：熱力圖全部是空格子，頁面列不變。 */
export const 沒有作答紀錄: Story = {};
