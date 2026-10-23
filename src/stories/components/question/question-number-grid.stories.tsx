import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState, type ComponentProps } from 'react';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';
import {
  comparePaperQuestionOrder,
  formatQuestionNumberLabel,
  isQuestionCorrect,
} from '@/lib/study';
import { law101MockExamAttempt, law101Questions } from '../../fixtures/question';
import { fixtureQuestionsFor } from '../../fixtures/questions';

interface GridItem {
  id: string;
  label: string;
  ariaLabel: string;
  stateLabel?: string;
  answered?: boolean;
  wrong?: boolean;
  difficult?: boolean;
  noted?: boolean;
}

interface Scenario {
  items: GridItem[];
  /** 一開始的目前題目。 */
  activeId: string;
}

/** 選擇題練習 20 題：前 8 題有對有錯，部分標記難題，第 9 題作答中。 */
const practiceResults: Record<number, 'correct' | 'wrong'> = {
  0: 'wrong',
  1: 'correct',
  2: 'correct',
  3: 'wrong',
  4: 'correct',
  5: 'correct',
  6: 'wrong',
  7: 'correct',
};
const practiceDifficult = new Set([1, 3, 8, 14]);

const mockExamDifficultIds = new Set(['law-101-15', 'law-101-27', 'law-101-40']);
/** 模擬考作答中：前 23 題除了第 9 題都作答過（不分對錯），第 24 題作答中。 */
const mockExamAnsweredIds = new Set(
  law101Questions
    .slice(0, 23)
    .filter((question) => question.questionNumber !== 9)
    .map((question) => question.id),
);

const structure113 = [...fixtureQuestionsFor('structure', 113)].sort(
  comparePaperQuestionOrder,
);
const notedIds = new Set([
  'structure-113-written-01',
  'structure-113-03',
  'structure-113-16',
  'structure-113-21',
]);
const notesDifficultIds = new Set([
  'structure-113-03',
  'structure-113-08',
  'structure-113-30',
]);

const scenarios = {
  '選擇題練習（20 題）': {
    activeId: 'practice-8',
    items: Array.from({ length: 20 }, (_, position) => ({
      id: `practice-${position}`,
      label: String(position + 1),
      ariaLabel: `前往第 ${position + 1} 題`,
      answered: Boolean(practiceResults[position]),
      wrong: practiceResults[position] === 'wrong',
      difficult: practiceDifficult.has(position),
    })),
  },
  '模擬考作答中（101 年法規 80 題）': {
    activeId: law101Questions[23].id,
    items: law101Questions.map((question, position) => ({
      id: question.id,
      label: String(position + 1),
      ariaLabel: `前往第 ${position + 1} 題`,
      stateLabel: mockExamAnsweredIds.has(question.id) ? '已作答' : '未作答',
      answered: mockExamAnsweredIds.has(question.id),
      difficult: mockExamDifficultIds.has(question.id),
    })),
  },
  '模擬考結果（101 年法規 80 題）': {
    activeId: law101Questions[0].id,
    items: law101Questions.map((question) => {
      const selected = law101MockExamAttempt.answers[question.id];
      const correct = isQuestionCorrect(question, selected);
      return {
        id: question.id,
        label: String(question.questionNumber),
        ariaLabel: `查看第 ${question.questionNumber} 題結果`,
        stateLabel: correct ? '答對' : selected === undefined ? '未作答' : undefined,
        answered: correct,
        wrong: selected !== undefined && !correct,
        difficult: mockExamDifficultIds.has(question.id),
      };
    }),
  },
  '筆記頁（113 年結構，含申論題）': {
    activeId: 'structure-113-16',
    items: structure113.map((question) => ({
      id: question.id,
      label: formatQuestionNumberLabel(question, true),
      ariaLabel: formatQuestionNumberLabel(question),
      difficult: question.format !== 'written' && notesDifficultIds.has(question.id),
      noted: notedIds.has(question.id),
    })),
  },
} satisfies Record<string, Scenario>;

type ScenarioName = keyof typeof scenarios;

/**
 * 選擇題練習與模擬考的題號在網站上是換題的連結（aria-current），外觀跟按鈕一樣；
 * 故事裡用按鈕，點了才會在同一個畫面換目前題目。
 */
function ScenarioGrid({ scenario }: { scenario: Scenario }) {
  const [activeId, setActiveId] = useState(scenario.activeId);
  return (
    <QuestionNumberGrid>
      {scenario.items.map(({ id, label, ...item }) => (
        <QuestionNumberButton
          key={id}
          {...item}
          active={id === activeId}
          onClick={() => setActiveId(id)}
        >
          {label}
        </QuestionNumberButton>
      ))}
    </QuestionNumberGrid>
  );
}

/**
 * 題號按鈕的排列：選擇題練習、模擬考的題號導覽，筆記頁的題號。綠色答對（模擬考作答中是
 * 已作答）、紅色答錯、橘色底線難題、紫點有筆記。
 *
 * 畫面上可以操作看到：點題號換目前題目。用 Controls 的「情境」換成其他頁的題號。
 */
const meta = {
  title: 'Components/題目/QuestionNumberGrid',
  component: QuestionNumberGrid,
  args: { children: null, scenario: '選擇題練習（20 題）' },
  argTypes: {
    children: { control: false, table: { disable: true } },
    scenario: {
      name: '情境',
      control: 'select',
      options: Object.keys(scenarios) as ScenarioName[],
    },
  },
  render: ({ scenario }) => (
    <ScenarioGrid key={scenario} scenario={scenarios[scenario]} />
  ),
} satisfies Meta<ComponentProps<typeof QuestionNumberGrid> & { scenario: ScenarioName }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 題號排列: Story = {};
