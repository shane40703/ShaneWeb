import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { fixtureImages, fixtureNoteContent } from '../../fixtures/app-state';
import { fixtureOptions } from '../../fixtures/question';
import { imageQuestion, screenshotQuestion } from '../../fixtures/questions';

const questionOptions = fixtureOptions(
  {
    '有筆記與圖片（101 年法規第 15 題）': screenshotQuestion,
    '還沒寫過筆記（101 年法規第 8 題）': imageQuestion,
  },
  '有筆記與圖片（101 年法規第 15 題）',
);

/**
 * 作答畫面、練習結果、常錯題目、我的難題、作答紀錄裡的「我的筆記」。一開始的第 15 題
 * 已存的筆記用到所有文字格式，附兩張圖片。
 * 已有內容時不顯示預設提示；清空文字會重新顯示，輸入後立即隱藏。
 *
 * 畫面上可以操作看到：
 * - 所見即所得輸入；舊筆記直接顯示效果。可切換粗體、斜體、底線、刪除線、上下標，
 *   選擇字色／自訂顏色、12～40px 字級，或使用清單、復原／重做、清除格式。
 * - 上傳、移除、放大圖片；4 張是上限，再上傳出現紅字提示。
 * - 「儲存筆記」：右下角出現「筆記已儲存」；把文字與圖片清空再儲存是「筆記已刪除」。
 * - 「分享到考古題討論版」：筆記一併儲存並分享成這題的詳解（Storybook 不連 Firebase，跟網站
 *   沒設定雲端時一樣只存在這台裝置）；沒有內容時是「尚無可分享的筆記」。
 * - Controls 的 question 換成還沒寫過筆記的題目：空白的筆記欄與提示文字。
 */
const meta = {
  title: 'Components/筆記與圖片/ReviewNoteEditor',
  component: ReviewNoteEditor,
  args: { question: questionOptions.initial },
  argTypes: { question: questionOptions.argType },
  parameters: {
    appState: {
      notes: { [screenshotQuestion.id]: fixtureNoteContent },
      noteImages: { [screenshotQuestion.id]: fixtureImages.slice(0, 2) },
    },
  },
  // 筆記編輯器只在打開時讀一次已存的筆記，換題目時重新打開。
  render: (args) => <ReviewNoteEditor key={args.question.id} {...args} />,
} satisfies Meta<typeof ReviewNoteEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 我的筆記: Story = {};
