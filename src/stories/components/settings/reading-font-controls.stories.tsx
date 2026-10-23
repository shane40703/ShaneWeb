import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ReadingFontControls } from '@/components/reading-font-controls';
import settingsStyles from '@/features/settings/settings-page.module.css';

/** Controls 的 className 選單：網站只用在設定的「閱讀設定」裡（每條滑桿放在灰底卡片）。 */
const classNames = {
  設定頁樣式: settingsStyles.controls,
  不加樣式: undefined,
};

/**
 * 題目字體、選項字體兩條滑桿（14～24px，每格 2px）。字級存在本機作答資料，預設都是 18px。
 * 寬度 540px 以下兩條滑桿改成上下排列（設定頁樣式是 650px 以下）。
 *
 * 畫面上可以操作看到：拖動滑桿，右上角的字級跟著改變（最小 14px、最大 24px，
 * 題目與選項可以各自調整）。
 *
 * Controls 可以看到：className 選「不加樣式」看元件本身沒有卡片的樣子。
 */
const meta = {
  title: 'Components/設定/ReadingFontControls',
  component: ReadingFontControls,
  args: {
    // 存的是 Controls 選單上的名稱，Storybook 畫面前會照 argTypes 的 mapping 換成 class。
    className: '設定頁樣式',
  },
  argTypes: {
    className: {
      control: 'inline-radio',
      options: Object.keys(classNames),
      mapping: classNames,
    },
  },
} satisfies Meta<typeof ReadingFontControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 字級滑桿: Story = {};
