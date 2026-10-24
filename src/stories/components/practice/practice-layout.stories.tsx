import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PracticeLayout } from '@/features/practice/practice-layout';

/**
 * 每日抽題練習、法規克漏字、歷屆試題模擬考共用的外框：頁面上方的「返回每日練習」。
 * 這裡只看外框本身，頁面內容（children）留空；實際內容見 Layouts 的各練習頁面。
 *
 * Controls 的 narrow：法規克漏字用的窄版，內容置中、最寬 1100px，「返回每日練習」貼齊內容左緣。
 */
const meta = {
  title: 'Components/每日練習/PracticeLayout',
  component: PracticeLayout,
  args: { children: null, narrow: false },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof PracticeLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};
