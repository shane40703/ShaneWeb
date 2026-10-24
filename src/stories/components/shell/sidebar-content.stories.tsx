import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import type { MouseEvent } from 'react';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { SidebarContent } from '@/components/layout/app-navigation';
import shellStyles from '@/components/layout/app-shell.module.css';

/** Controls 的 pathname 選單：側欄連得到的頁面。 */
const pathnameLabels = {
  '/': '首頁',
  '/practice': '每日練習',
  '/exams': '考古題討論版',
  '/resources': '歷屆試題資料集成',
  '/notes': '使用者筆記',
  '/difficult': '難題標記',
  '/wrong': '常錯題目',
  '/history': '已作答紀錄',
  '/settings': '設定',
  '/report': '問題回報',
};

/** 跟桌機外框一樣放在 260px 寬、整個視窗高的側欄裡。 */
const inSidebar: Decorator = (Story) => (
  <div style={{ width: 260 }}>
    <aside className={shellStyles.desktopSidebar}>
      <Story />
    </aside>
  </div>
);

/**
 * 桌機的側欄內容：網站名稱、主要功能（每日練習、考古題討論版、歷屆試題資料集成、我的作答存摺）與
 * 下方的設定、問題回報。從「已作答紀錄」開始，「我的作答存摺」標示為目前位置。
 * 寬度 800px 以下網站改用抽屜選單，所以固定用筆電寬度。
 *
 * 畫面上可以操作看到：點連結換成那一頁的目前頁面標示（「設定」在網站上是開啟設定視窗，
 * 只記錄在 Actions 面板）；滑過或點「我的作答存摺」在同一個外框內往下展開，點子選單裡的頁面
 * 換標示並收起子選單。Controls 的 pathname 也跟著更新。
 *
 * 手機抽屜裡的側欄（inDrawer：子選單往下展開、項目較高）只在手機寬度出現，看
 * `Components/基礎 UI/SideDrawer`，或 `Layouts/網站外框/側欄與頂部列` 切到手機寬度。
 */
const meta = {
  title: 'Components/網站外框/SidebarContent',
  component: SidebarContent,
  decorators: [inSidebar],
  globals: { viewport: { value: 'laptop' } },
  parameters: { layout: 'fullscreen' },
  args: {
    pathname: '/history',
    onNavigate: fn(),
    onOpenSettings: fn(),
  },
  argTypes: {
    pathname: {
      control: { type: 'select', labels: pathnameLabels },
      options: Object.keys(pathnameLabels),
    },
    // 抽屜的互動交由網站外框故事在手機寬度中操作。
    inDrawer: { control: false },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    // Storybook 的 next/link 只記錄點擊；點側欄連結時改成那一頁的標示。
    function followLink(event: MouseEvent) {
      const href = (event.target as Element).closest('a[href]')?.getAttribute('href');
      if (!href || href === '/settings') return;
      updateArgs({ pathname: href });
    }
    return (
      <div style={{ display: 'contents' }} onClickCapture={followLink}>
        <SidebarContent {...args} />
      </div>
    );
  },
} satisfies Meta<typeof SidebarContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 側欄: Story = {};
