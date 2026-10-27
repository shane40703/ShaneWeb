import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IconTrash } from '@tabler/icons-react';
import { fn } from 'storybook/test';
import { Button, ConfirmDialog } from '@/components/ui/ui';

/**
 * 刪除、清除前跳出的確認視窗。網站上的四種用途並排，按下按鈕才跳出視窗：
 * 我的筆記的「刪除筆記」、歷屆試題作答履歷的「清除第 2 次紀錄」、考古題討論版討論區刪除自己的
 * 共享投稿、速記圖庫管理的「下架」。
 *
 * 畫面上可以操作看到：按任一個按鈕跳出確認視窗（用滑鼠按開時焦點在「取消」但不畫焦點框；
 * 用 Tab 移到按鈕再按 Enter 開啟時會畫出焦點框），按「取消」、確認按鈕或 Esc 關閉（按背景不會
 * 關閉，確認按鈕記在 Actions）。
 * 第一個「刪除筆記」的文字可以用 Controls 調整。
 */
const meta = {
  title: 'Components/基礎 UI/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    trigger: (
      <Button variant="danger">
        <IconTrash size={16} stroke={2} aria-hidden="true" />
        刪除筆記
      </Button>
    ),
    title: '刪除第 15 題筆記？',
    description: '文字與上傳的筆記圖片都會刪除，且無法復原。',
    confirmLabel: '確認刪除',
    onConfirm: fn(),
  },
  argTypes: { trigger: { control: false } },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 全部用途: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <ConfirmDialog {...args} />
      <ConfirmDialog
        trigger={
          <Button variant="danger">
            <IconTrash size={16} stroke={2} aria-hidden="true" />
            清除第 2 次紀錄
          </Button>
        }
        title="清除第 2 次作答紀錄？"
        description="只會刪除這一次的作答結果，其他紀錄與筆記不受影響。"
        confirmLabel="確認清除"
        onConfirm={args.onConfirm}
      />
      <ConfirmDialog
        trigger={
          <Button variant="danger">
            <IconTrash size={16} stroke={2} aria-hidden="true" />
            刪除
          </Button>
        }
        title="刪除這則共享投稿？"
        description="刪除後所有使用者都不會再看到這則內容。"
        confirmLabel="確認刪除"
        onConfirm={args.onConfirm}
      />
      <ConfirmDialog
        trigger={
          <Button variant="danger" aria-label="下架 構造高度限制整理">
            下架
          </Button>
        }
        title="下架「構造高度限制整理」？"
        description="只從圖庫清單移除；原圖及索引保留於專案，可透過 Git 或圖庫索引還原。"
        confirmLabel="確認下架"
        onConfirm={args.onConfirm}
      />
    </div>
  ),
};
