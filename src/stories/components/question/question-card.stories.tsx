import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { QuestionCard } from '@/components/content/content';
import { fixtureOptions, sampleSourceQuestion } from '../../fixtures/question';
import {
  getFixtureQuestion,
  imageQuestion,
  longStemQuestion,
  screenshotQuestion,
} from '../../fixtures/questions';

const questionOptions = fixtureOptions(
  {
    '含圖片（101 年法規第 8 題）': imageQuestion,
    一般題目: screenshotQuestion,
    '長題幹（113 年構造第 5 題）': longStemQuestion,
    '兩個法規分類（101 年法規第 11 題）': getFixtureQuestion('law-101-11'),
    示範題: sampleSourceQuestion,
  },
  '含圖片（101 年法規第 8 題）',
);

/**
 * 常錯題目、我的難題列表裡的題目卡片：年度、科目、題號、法規分類標籤，精簡版題目，
 * 右側是難題按鈕與「查看詳解」。一開始是附圖的題目。
 *
 * 畫面上可以操作看到：點難題按鈕切換標記；滑過題目圖片出現放大按鈕，點了全螢幕放大。
 * 用 Controls 換題目（一般題目、長題幹、兩個法規分類、示範題）。
 */
const meta = {
  title: 'Components/題目/QuestionCard',
  component: QuestionCard,
  args: {
    question: questionOptions.initial,
    difficult: false,
    onToggleDifficult: fn(),
  },
  argTypes: {
    question: questionOptions.argType,
    // 網站的列表都用預設的「查看詳解」按鈕。
    action: { control: false },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <QuestionCard
        {...args}
        onToggleDifficult={() => {
          args.onToggleDifficult();
          updateArgs({ difficult: !args.difficult });
        }}
      />
    );
  },
} satisfies Meta<typeof QuestionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 題目卡片: Story = {};
