import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import HomeRoute from '@/pages/index';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 首頁（/）：四個科目卡片，點選後進入該科的歷屆試題模擬考選年份（換到其他頁，
 * 在故事裡只記錄在 Actions 面板）。
 *
 * 工具列的視窗寬度切到平板（1050px 以下）改成兩欄，切到手機（560px 以下）改成一欄。
 */
const meta = {
  title: 'Layouts/首頁/選擇科目',
  component: HomeRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/') },
} satisfies Meta<typeof HomeRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
