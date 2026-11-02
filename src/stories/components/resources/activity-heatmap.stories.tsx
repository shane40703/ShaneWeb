import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ACTIVITY_LEVEL_STARTS } from '@/features/personal/activity-heatmap';
import { ActivityHeatmap } from '@/features/personal/activity-heatmap-panel';
import type { QuizAttempt } from '@/lib/types';
import { FIXTURE_NOW } from '../../fixtures/app-state';
import { heatmapAttempts } from '../../fixtures/personal';

/** 選單存的是選項名稱，Storybook 畫故事前才照 mapping 換成作答紀錄。 */
const levelAttempts = ACTIVITY_LEVEL_STARTS.map((correctCount, index) => ({
  ...heatmapAttempts[0],
  id: `story-activity-level-${index + 1}`,
  submittedAt: new Date(Date.parse(FIXTURE_NOW) - index * 86_400_000).toISOString(),
  questionIds: [],
  answers: {},
  correctCount,
  wrongCount: 0,
  unansweredCount: 0,
}));
const attemptSets = { empty: [], year: heatmapAttempts, levels: levelAttempts };

/**
 * 我的作答存摺的活動熱力圖：過去一年每天的作答題數，每欄一週，月份之間沒有間距。
 * 電腦版的格子隨面板寬度等比放大並填滿版面；格子不能點，滑過顯示幾月幾號與題數，
 * 例如 10/10, 50題。
 *
 * 色階全部由使用者選的重點色混出，換配色時一起變。從 1、20、40、80、160、320 題起各一階，共六階，
 * 320 題以上就是重點色本身；零題另有底色。圖例只標少到多。面板裡的文字不能選取或複製。
 * Controls 的 attempts 可切換「沒有紀錄」、「一年份紀錄」或「六階範例」；today 改成今天以外的日期會重算
 * 53 週，留空就是網站拿到臺灣日期之前的空格子。工具列切到手機寬度時格子在面板內捲動，
 * 一打開停在最近幾週。
 */
const meta = {
  title: 'Components/統計分析/ActivityHeatmap',
  component: ActivityHeatmap,
  args: {
    attempts: 'year' as unknown as QuizAttempt[],
    today: FIXTURE_NOW.slice(0, 10),
  },
  argTypes: {
    attempts: {
      options: Object.keys(attemptSets),
      mapping: attemptSets,
      control: { type: 'select', labels: { empty: '沒有紀錄', year: '一年份紀錄', levels: '六階範例' } },
    },
    today: { control: 'text' },
  },
  // 我的作答存摺的最外層是容器，面板依它的寬度收合內距。
  decorators: [
    (Story) => (
      <div style={{ containerType: 'inline-size' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityHeatmap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
