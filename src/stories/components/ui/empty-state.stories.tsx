import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Link from 'next/link';
import { EmptyState } from '@/components/content/content';
import { Button } from '@/components/ui/ui';
import {
  practiceMockExamPage,
  practiceQuizPage,
} from '@/features/practice/practice-pages';

/**
 * 沒有資料、讀取中、載入失敗時頁面中間的說明：置中的兩行淡墨文字，標題一行、說明一行，
 * 需要時下面放按鈕。讀取中、載入失敗與沒有資料長得一樣，只差文字。
 * 網站上的四種樣子並排：
 * - 歷屆試題作答履歷還沒有紀錄：下面有兩個開始作答的按鈕（history-page）。
 * - 題庫下載失敗：有「重新載入」按鈕（exams-page、notes-page）。
 * - 難題標記還沒有任何題目：沒有按鈕（difficult-page）。
 * - 讀取中：同一個元件，只換文字（history-page、difficult-page）。
 *
 * 第一個的標題與說明可以用 Controls 調整。各頁實際的空白畫面請看各頁 Layouts 的「沒有資料」故事。
 */
const meta = {
  title: 'Components/基礎 UI/EmptyState',
  component: EmptyState,
  args: {
    title: '還沒有作答紀錄',
    description: '完成每日抽題練習或歷屆試題模擬考並交卷後，結果會保存在這裡。',
    action: (
      <>
        <Button role="link" render={<Link href={practiceQuizPage.href} />}>
          每日抽題練習
        </Button>
        <Button
          role="link"
          variant="primary"
          render={<Link href={practiceMockExamPage.href} />}
        >
          開始第一份試卷
        </Button>
      </>
    ),
  },
  argTypes: { action: { control: false } },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 全部用途: Story = {
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
        gap: 16,
      }}
    >
      <EmptyState {...args} />
      <EmptyState
        title="題庫載入失敗"
        description="目前無法取得完整題庫，請重新載入後再試。"
        action={<Button>重新載入</Button>}
      />
      <EmptyState
        title="還沒有標記難題"
        description="在作答頁、交卷結果或詳解頁按下「標記為難題」，題目就會出現在這裡。"
      />
      <EmptyState title="正在讀取紀錄" description="請稍候。" />
    </div>
  ),
};
