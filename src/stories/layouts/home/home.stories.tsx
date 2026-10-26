import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HomePage } from '@/features/home/home-page';
import { FIXTURE_NOW } from '../../fixtures/app-state';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 首頁（/）：最上方為大型建築師考試倒數與官方日程，下方有每日抽題捷徑及四個科目卡片。
 * 倒數固定使用範例日期；Controls 的 today 可切換考前、考試期間與考後，不會出現負天數。
 * 科目卡片點選後進入該科的歷屆試題模擬考選年份（換到其他頁，
 * 在故事裡只記錄在 Actions 面板）。
 *
 * 工具列的視窗寬度切到平板（1050px 以下）改成兩欄，切到手機（560px 以下）改成一欄。
 */
const meta = {
  title: 'Layouts/首頁/選擇科目',
  component: HomePage,
  args: { today: FIXTURE_NOW.slice(0, 10) },
  argTypes: { today: { options: ['2026-10-20', '2026-11-13', '2026-11-14', '2026-11-16', '2026-11-17'], control: 'select' } },
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/') },
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
