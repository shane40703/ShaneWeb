import type { Decorator } from '@storybook/nextjs-vite';
import { PersonalLayout } from '@/features/personal/personal-layout';

/**
 * 跟我的作答存摺底下的頁面一樣的外層：頁面上方的「返回我的作答存摺」。只有直接畫頁面元件、
 * 用 props 固定狀態的故事需要它；畫整個頁面的故事已經有這一層。
 *
 * 放在故事自己的 decorators（排在 meta 的 withPageFrame 裡面）。
 */
export const withPersonalFrame: Decorator = (Story) => (
  <PersonalLayout>
    <Story />
  </PersonalLayout>
);
