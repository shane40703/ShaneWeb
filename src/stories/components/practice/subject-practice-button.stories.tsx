import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SubjectPracticeButton } from '@/features/practice/subject-practice-button';
import { fixtureSubjectQuestions } from '../../fixtures/questions';
import { pageParameters } from '../../support/story-environment';

/**
 * 難題與常錯題目清單的整組練習入口。Controls 切換難題／錯題或題庫尚未完整載入。
 * 點擊會存入該科所有年度的選擇題，再導向每日抽題練習（跨頁導向記錄在 Actions）。
 */
const meta = {
  title: 'Components/每日練習/SubjectPracticeButton',
  component: SubjectPracticeButton,
  parameters: { ...pageParameters('/difficult') },
  args: { questions: fixtureSubjectQuestions('law'), subject: 'law', source: 'difficult', loading: false },
  argTypes: {
    questions: { control: false }, subject: { control: false },
    source: { options: ['difficult', 'wrong'], control: { type: 'select', labels: { difficult: '難題標記', wrong: '常錯題目' } } },
  },
} satisfies Meta<typeof SubjectPracticeButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const 本科目整組重練: Story = {};
