import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AttemptReview } from '@/components/attempt-review';
import type { QuizAttempt } from '@/lib/types';
import { fixtureImages, fixtureNoteContent } from '../../fixtures/app-state';
import {
  earlierPracticeAttempts,
  fixtureDiscussionPosts,
  fixtureOptions,
  law101MockExamAttempt,
  practiceReviewAttempt,
  withScreenshotExplanation,
} from '../../fixtures/question';
import { getFixtureQuestion, screenshotQuestion } from '../../fixtures/questions';

const attemptOptions = fixtureOptions(
  {
    '每日抽題練習（8 題）': practiceReviewAttempt,
    '101 年法規模擬考（80 題）': law101MockExamAttempt,
  },
  '每日抽題練習（8 題）',
);

/** 跟作答紀錄、模擬考結果一樣，照作答紀錄的題目順序列出題目。 */
function attemptQuestions(attempt: QuizAttempt) {
  return withScreenshotExplanation(attempt.questionIds.map(getFixtureQuestion));
}

/**
 * 作答紀錄、模擬考結果的逐題作答結果：綠色答對、紅色答錯、灰色未作答，之前也答錯過的
 * 題目標「已答錯 N 次」。截圖題（101 年第 15 題）有內建詳解、分享的詳解（附圖）、補充與
 * 提問，也有已存的筆記與圖片。
 *
 * 畫面上可以操作看到：
 * - 第 15 題的「顯示詳解與討論」：詳解與討論；其他題：「尚未有詳解或討論」。
 * - 「檢視完整選項與筆記」：標出你的答案與正確答案，下方是使用者筆記（可以編輯、儲存、分享）。
 * - 每題的難題按鈕。
 * - 工具列「雲端同步」切到雲端狀態再展開詳解與討論：一直停在「正在載入詳解與討論…」
 *   （Storybook 不會連到 Firebase）。
 * - Controls 的 attempt 換作答紀錄：
 *   - 每日抽題練習（8 題）：答錯 3 題、答對 3 題、未作答 2 題。一律給分的第 17 題沒作答，
 *     在每日抽題練習算未作答。第 27 題連同之前共答錯 3 次、第 15 題 2 次。
 *   - 101 年法規模擬考（80 題）：答錯 10 題、空白 3 題。一律給分的第 17 題沒作答也算答對。
 * - Controls 的 embedded：作答紀錄裡內嵌（沒有外框）；模擬考結果頁是有外框的版本。
 */
const meta = {
  title: 'Components/題目/AttemptReview',
  component: AttemptReview,
  args: {
    attempt: attemptOptions.initial,
    questions: attemptQuestions(practiceReviewAttempt),
    embedded: true,
    showDifficultActions: true,
  },
  argTypes: {
    attempt: attemptOptions.argType,
    // 題目跟著 attempt 換。
    questions: { table: { disable: true } },
    // 只用來給模擬考結果的題號導覽跳到題目，畫面上看不出差別。
    anchorPrefix: { control: false },
  },
  parameters: {
    appState: {
      // 正在看的這次作答由元件自己算進「已答錯 N 次」。
      attempts: earlierPracticeAttempts,
      difficultQuestionIds: ['law-101-15', 'law-101-08', 'law-101-27'],
      discussionPosts: fixtureDiscussionPosts,
      notes: { [screenshotQuestion.id]: fixtureNoteContent },
      noteImages: { [screenshotQuestion.id]: fixtureImages.slice(0, 2) },
    },
  },
  render: (args) => (
    <AttemptReview
      key={args.attempt.id}
      {...args}
      questions={attemptQuestions(args.attempt)}
    />
  ),
} satisfies Meta<typeof AttemptReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 逐題作答結果: Story = {};
