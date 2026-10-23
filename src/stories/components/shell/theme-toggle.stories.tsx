import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ThemeToggle } from '@/components/layout/theme-toggle';

/**
 * 頂部列右上角的深淺色切換。淺色時顯示月亮圖示與「深色模式」，深色時顯示太陽圖示與
 * 「淺色模式」；寬度 800px 以下只剩圖示。
 *
 * 畫面上可以操作看到：按一下切換整個畫面的深淺色（重新整理後回到工具列「主題」的設定）。
 * 工具列的「主題」切換深淺色，視窗寬度切到手機看只剩圖示的樣子。
 */
const meta = {
  title: 'Components/網站外框/ThemeToggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 深淺色切換: Story = {};
