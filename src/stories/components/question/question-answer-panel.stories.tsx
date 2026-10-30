import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { fixtureOptions } from '../../fixtures/question';
import {
  allCreditQuestion,
  getFixtureQuestion,
  longQuestion,
  screenshotQuestion,
} from '../../fixtures/questions';
import { readingFontSizeArgType, useReadingFontSize } from './reading-font-size';

const questionOptions = fixtureOptions(
  {
    一般題目: screenshotQuestion,
    '多個正確答案（B、D 都給分）': getFixtureQuestion('law-113-33'),
    一律給分: allCreditQuestion,
    長選項: longQuestion,
  },
  '一般題目',
);

const answerOptions = fixtureOptions({ 未作答: undefined, A: 0, B: 1, C: 2, D: 3 }, 'D');

/**
 * 標出正確答案與你的答案的完整選項：每日抽題練習結果（有「題目選項」標題）、考古題討論版、
 * 筆記頁、作答紀錄與錯題統計（沒有標題）。
 * 選項之間共用淺色分隔線，第一個上方與最後一個下方不加線。
 * 一律給分的題目在選項上方多一行綠色說明「本題一律給分，四個選項都算正確。」，四列都標為正確。
 *
 * 用 Controls 調整：題目（一般、多個正確答案、一律給分、長選項）、你的答案
 * （selectedIndex，未作答時只標出正確答案）、右側註明（showStatusLabels）、
 * 標題（heading，清空就不顯示）、字級。
 * originalOptionIndexes 可開啟淡色原選項標記示範；每日練習結果會依當次打亂的順序自動對照。
 */
const meta = {
  title: 'Components/題目/QuestionAnswerPanel',
  component: QuestionAnswerPanel,
  args: {
    question: questionOptions.initial,
    selectedIndex: answerOptions.initial,
    showStatusLabels: true,
    originalOptionIndexes: 'none' as unknown as readonly number[],
    heading: '題目選項',
    fontSize: 18,
  },
  argTypes: {
    originalOptionIndexes: {
      options: ['none', 'original'],
      mapping: { none: undefined, original: [0, 1, 2, 3] },
      control: { type: 'inline-radio', labels: { none: '不顯示', original: '顯示原選項標記' } },
    },
    question: questionOptions.argType,
    selectedIndex: answerOptions.argType,
    heading: { control: 'text' },
    fontSize: readingFontSizeArgType,
  },
  render: function Render({ fontSize, ...args }) {
    useReadingFontSize(fontSize);
    return <QuestionAnswerPanel {...args} />;
  },
} satisfies Meta<ComponentProps<typeof QuestionAnswerPanel> & { fontSize: number }>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一開始是每日抽題練習結果的錯題：截圖題選了 D（答錯），正解 A。 */
export const 選項與答案: Story = {};
