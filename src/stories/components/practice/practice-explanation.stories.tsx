import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PracticeExplanation } from '@/features/practice/practice-explanation';
import type { Question } from '@/lib/types';
import { practiceDiscussionPosts } from '../../fixtures/practice';
import {
  getFixtureQuestion,
  screenshotQuestion,
  withExplanation,
} from '../../fixtures/questions';

/** Controls 的 question 選單（選單名稱見 argTypes 的 labels）。 */
const questions = {
  none: screenshotQuestion,
  builtIn: withExplanation(screenshotQuestion),
  // 113 年第 33 題，正確答案是 B、D。
  twoAnswers: getFixtureQuestion('law-113-33'),
} satisfies Record<string, Question>;

/** 選單存的是選項名稱，Storybook 畫故事前才照 mapping 換成題目。 */
function questionChoice(name: keyof typeof questions) {
  return name as unknown as Question;
}

/**
 * 每日練習的詳解區：題庫的內建詳解，加上其他使用者分享的詳解與補充（提問不會出現在這裡）。
 * 都沒有時提示比較正確選項。
 *
 * Controls：
 * - question：尚無詳解（網站目前的題庫都是這樣）、有內建詳解、兩個正確答案。
 * - showAnswers：練習結果的錯題整理會寫出正確答案與「你的答案」（selectedIndex，0 是 A）；
 *   作答畫面上方的答對／答錯提示已寫出答案，所以關掉，只顯示「詳解」。
 *
 * 工具列「雲端同步」切到雲端狀態時，會一直停在「正在載入詳解與討論…」（Storybook 不連 Firebase）。
 */
const meta = {
  title: 'Components/每日練習/PracticeExplanation',
  component: PracticeExplanation,
  // 跟作答畫面差不多的寬度。
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: { question: questionChoice('none'), selectedIndex: 2, showAnswers: true },
  argTypes: {
    question: {
      options: Object.keys(questions),
      mapping: questions,
      control: {
        type: 'select',
        labels: { none: '尚無詳解', builtIn: '有內建詳解', twoAnswers: '兩個正確答案' },
      },
    },
  },
} satisfies Meta<typeof PracticeExplanation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 預設: Story = {};

/** 截圖那題有其他使用者分享的詳解與補充（含圖片）；question 選「兩個正確答案」時不會出現。 */
export const 有社群詳解: Story = {
  parameters: {
    appState: { discussionPosts: practiceDiscussionPosts(screenshotQuestion.id) },
  },
};
