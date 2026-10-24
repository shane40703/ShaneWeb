import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { WrongCategoryAnalysis } from '@/components/wrong-category-analysis';
import {
  law101MockExamAttempt,
  law101Questions,
  law113MockExamAttempt,
  law113Questions,
  practiceReviewAttempt,
} from '../../fixtures/question';

type AnalysisProps = ComponentProps<typeof WrongCategoryAnalysis>;

/** 跟網站一樣的兩種用法：模擬考結果、作答紀錄展開的單次作答，以及作答紀錄上方的跨年度分析。 */
const scenarios = {
  '單次作答（101 年法規模擬考）': {
    attempt: law101MockExamAttempt,
    questions: law101Questions,
  },
  '跨年度錯題分析（三次作答合併）': {
    attempts: [law101MockExamAttempt, law113MockExamAttempt, practiceReviewAttempt],
    questions: [...law101Questions, ...law113Questions],
    title: '跨年度錯題分析',
    eyebrow: 'CROSS-YEAR WRONG ANSWER ANALYSIS',
    ariaLabel: '跨年度錯題分析',
  },
} satisfies Record<string, AnalysisProps>;

type ScenarioName = keyof typeof scenarios;

/**
 * 模擬考結果與作答紀錄的「錯題類型統計」：答錯的題目依法規分類，多的排前面。
 * 全部答對時不顯示。
 *
 * 畫面上可以操作看到：
 * - 點其他類別，下方換成該類別的錯題（題目、你的答案、正確答案）。
 * - Controls 的「情境」：
 *   - 單次作答（101 年法規模擬考）：答錯 10 題，分成 6 類。
 *   - 跨年度錯題分析：101、113 年模擬考加一次每日抽題練習合併，每題列出答錯的時間。
 */
const meta = {
  title: 'Components/題目/WrongCategoryAnalysis',
  component: WrongCategoryAnalysis,
  // 元件的 props 都跟著「情境」換，這裡只是一開始的情境。
  args: {
    scenario: '單次作答（101 年法規模擬考）',
    ...scenarios['單次作答（101 年法規模擬考）'],
  },
  argTypes: {
    scenario: {
      name: '情境',
      control: 'select',
      options: Object.keys(scenarios) as ScenarioName[],
    },
    attempt: { table: { disable: true } },
    attempts: { table: { disable: true } },
    questions: { table: { disable: true } },
    title: { table: { disable: true } },
    eyebrow: { table: { disable: true } },
    ariaLabel: { table: { disable: true } },
  },
  render: ({ scenario }) => (
    <WrongCategoryAnalysis key={scenario} {...scenarios[scenario]} />
  ),
} satisfies Meta<AnalysisProps & { scenario: ScenarioName }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 錯題類型統計: Story = {};
