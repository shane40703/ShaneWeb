import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Link from 'next/link';
import { IconMenu2, IconNotebook, IconPencil, IconTrash } from '@tabler/icons-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/ui';

const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 } as const;

/**
 * 網站的按鈕。所有樣式並排，方便一起比較與調整：
 * - 第一列可以按、第二列停用（例如還沒選答案時的「確認答案」）。
 * - 主要（每頁最主要的動作）、主要加圖示、次要（預設樣式）、文字按鈕（作答畫面的「跳過」、
 *   討論區的「加入我的筆記」）、危險（刪除、清除）、只有圖示（手機版頂部列的選單按鈕）。
 * - 最後是外觀是按鈕、實際是連結的「開始第一份試卷」，以及填滿容器寬度的「送出共享投稿」
 *   （考古題討論版右欄）。
 *
 * 畫面上可以操作看到：滑鼠移上去、按下、用 Tab 移到按鈕上的焦點框。
 */
const meta = {
  title: 'Components/基礎 UI/Button',
  component: Button,
  args: { onClick: fn() },
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 全部樣式: Story = {
  render: function Render({ onClick }) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[false, true].map((disabled) => (
          <div key={String(disabled)} style={row}>
            <Button variant="primary" disabled={disabled} onClick={onClick}>
              確認答案
            </Button>
            <Button variant="primary" disabled={disabled} onClick={onClick}>
              <IconPencil size={16} stroke={2} aria-hidden="true" />
              編輯筆記
            </Button>
            <Button disabled={disabled} onClick={onClick}>
              重新載入
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={onClick}>
              跳過
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={onClick}>
              <IconNotebook size={17} stroke={2} aria-hidden="true" />
              加入我的筆記
            </Button>
            <Button variant="danger" disabled={disabled} onClick={onClick}>
              <IconTrash size={16} stroke={2} aria-hidden="true" />
              刪除筆記
            </Button>
            <Button
              variant="icon"
              aria-label="開啟選單"
              disabled={disabled}
              onClick={onClick}
            >
              <IconMenu2 size={21} stroke={2} aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div style={row}>
          <Button
            variant="primary"
            role="link"
            render={<Link href="/practice/mock-exam" />}
          >
            開始第一份試卷
          </Button>
        </div>
        <div style={{ maxWidth: 360 }}>
          <Button variant="primary" fullWidth onClick={onClick}>
            送出共享投稿
          </Button>
        </div>
      </div>
    );
  },
};
