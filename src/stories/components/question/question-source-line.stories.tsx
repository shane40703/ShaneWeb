import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QuestionSourceLine } from '@/components/content/content';
import { fixtureOptions, sampleSourceQuestion } from '../../fixtures/question';
import { screenshotQuestion } from '../../fixtures/questions';

const questionOptions = fixtureOptions(
  { 考選部官方試題: screenshotQuestion, 示範題: sampleSourceQuestion },
  '考選部官方試題',
);

/**
 * 歷屆試題題目下方的資料來源：官方試題連到試題 PDF 的頁數；示範題沒有官方來源，
 * 只顯示說明文字。用 Controls 的 question 切換。
 */
const meta = {
  title: 'Components/題目/QuestionSourceLine',
  component: QuestionSourceLine,
  args: { question: questionOptions.initial },
  argTypes: { question: questionOptions.argType },
} satisfies Meta<typeof QuestionSourceLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 資料來源: Story = {};
