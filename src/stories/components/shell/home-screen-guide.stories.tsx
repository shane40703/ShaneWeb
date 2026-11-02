import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { HomeScreenGuide } from '@/components/layout/home-screen-guide';

/** Controls 的 mode 選單：網站會依裝置與瀏覽器自動選一種。 */
const modeLabels = {
  ios: 'iPhone、iPad',
  android: 'Android 瀏覽器',
  'ios-in-app': 'iPhone 的其他 App 裡',
  'android-in-app': 'Android 的其他 App 裡',
};

/**
 * 按下側欄「加入主畫面」後跳出的操作步驟。Android 的瀏覽器能直接跳出系統的安裝視窗時不會
 * 用到這個對話框，那個視窗是系統畫的，Storybook 看不到。
 *
 * 畫面上可以操作看到：Controls 的 mode 切換四種文字：iPhone、iPad，Android 瀏覽器，以及在
 * iPhone、Android 的其他 App 裡。按「知道了」或 Esc 只會記在 Actions 面板，對話框不會關閉，
 * 因為網站上是外層在收到通知後才拿掉它。
 */
const meta = {
  title: 'Components/網站外框/HomeScreenGuide',
  component: HomeScreenGuide,
  args: {
    mode: 'ios',
    onClose: fn(),
  },
  argTypes: {
    mode: {
      control: { type: 'select', labels: modeLabels },
      options: Object.keys(modeLabels),
    },
  },
} satisfies Meta<typeof HomeScreenGuide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 操作步驟: Story = {};
