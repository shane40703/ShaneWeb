import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SimilarQuestions } from '@/components/similar-questions';
import { fixtureQuestions, getFixtureQuestion } from '../../fixtures/questions';

/**
 * 考古題討論版與筆記頁下方的類似考題：同主題的其他年度題目，依年度遠近排序。
 * 用 Controls 的 basePath 切換連到考古題討論版（/exams）或筆記頁（/notes），外觀相同。
 */
const meta = {
  title: 'Components/題目/SimilarQuestions',
  component: SimilarQuestions,
  args: {
    // 101 年法規第 39 題（都市更新），範例題庫裡還有 4 題同主題。
    question: getFixtureQuestion('law-101-39'),
    questions: fixtureQuestions,
    basePath: '/exams',
  },
  argTypes: {
    basePath: { control: 'inline-radio', options: ['/exams', '/notes'] },
    question: { control: false },
    questions: { control: false },
  },
} satisfies Meta<typeof SimilarQuestions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 類似考題: Story = {};
