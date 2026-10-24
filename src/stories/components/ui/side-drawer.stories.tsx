import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { SidebarContent } from '@/components/layout/app-navigation';
import { SideDrawer } from '@/components/ui/ui';

/**
 * 手機版頂部列左上角的選單按鈕，按下從左側滑出網站的側欄導覽，目前頁面（每日抽題練習所在的
 * 每日練習）會標示出來。選單按鈕只在寬度 800px 以下出現，所以預設用手機寬度。
 *
 * 畫面上可以操作看到：按選單按鈕打開抽屜；抽屜裡按「我的作答存摺」展開個人頁面的選單；
 * 按背景、導覽連結、Esc 或用手指往左滑關閉。Controls 的 open 也跟著更新。
 *
 * 一開始是收合的：不按選單按鈕直接打開時，瀏覽器會在抽屜外圍畫出網站上看不到的焦點框。
 */
const meta = {
  title: 'Components/基礎 UI/SideDrawer',
  component: SideDrawer,
  args: {
    open: false,
    onOpenChange: fn(),
    triggerLabel: '開啟選單',
    title: '主要功能',
    children: null,
  },
  argTypes: { children: { control: false } },
  globals: { viewport: { value: 'mobile' } },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    function changeOpen(open: boolean) {
      args.onOpenChange(open);
      updateArgs({ open });
    }
    return (
      <SideDrawer {...args} onOpenChange={changeOpen}>
        <SidebarContent
          inDrawer
          pathname="/practice/quiz"
          onNavigate={() => changeOpen(false)}
          onOpenSettings={() => undefined}
        />
      </SideDrawer>
    );
  },
} satisfies Meta<typeof SideDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 網站導覽: Story = {};
