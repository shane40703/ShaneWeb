import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { QuestionPrompt } from '@/components/content/content';
import { fixtureOptions } from '../../fixtures/question';
import {
  getFixtureQuestion,
  imageQuestion,
  longStemQuestion,
  screenshotQuestion,
  writtenQuestion,
} from '../../fixtures/questions';
import { readingFontSizeArgType, useReadingFontSize } from './reading-font-size';

const questionOptions = fixtureOptions(
  {
    一般題目: screenshotQuestion,
    '含圖片（101 年法規第 8 題）': imageQuestion,
    '長題幹（113 年構造第 5 題）': longStemQuestion,
    申論題: writtenQuestion,
    '申論題含圖片（113 年結構申論第 1 題）': getFixtureQuestion(
      'structure-113-written-01',
    ),
  },
  '含圖片（101 年法規第 8 題）',
);

/**
 * 題目的題幹：文字段落與題目附圖。作答畫面、考古題討論版用一般版；常錯題目、我的難題、
 * 錯題統計等列表用精簡版（compact，間距與圖片較小）。
 *
 * 畫面上可以操作看到：滑過圖片出現放大按鈕，點了全螢幕放大題目圖片（按背景、右上角或 Esc
 * 關閉）。用 Controls 換題目（一般、含圖片、長題幹、申論題）、精簡版、字級。
 */
const meta = {
  title: 'Components/題目/QuestionPrompt',
  component: QuestionPrompt,
  args: { question: questionOptions.initial, compact: false, fontSize: 18 },
  argTypes: {
    question: questionOptions.argType,
    fontSize: readingFontSizeArgType,
  },
  render: function Render({ fontSize, ...args }) {
    useReadingFontSize(fontSize);
    return <QuestionPrompt {...args} />;
  },
} satisfies Meta<ComponentProps<typeof QuestionPrompt> & { fontSize: number }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 題幹: Story = {};
