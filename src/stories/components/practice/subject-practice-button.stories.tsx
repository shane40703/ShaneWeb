import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SubjectPracticeButton } from '@/features/practice/subject-practice-button';
import { fixtureSubjectQuestions } from '../../fixtures/questions';
import { pageParameters } from '../../support/story-environment';

/**
 * 難題與常錯題目清單的整組練習入口。Controls 切換難題／錯題或題庫尚未完整載入。
 * 點擊先開啟進階設定：預設最多 50 題，可選常用題數、任意整數或全部，並切換選項打亂。
 * 常錯題目不足全選時依答錯次數加權抽題；難題標記仍維持隨機抽題。
 * 「取消」或 Escape 不會覆蓋進度；「開始練習」才抽出題組並導向每日抽題練習（記錄在 Actions）。
 */
const meta = {
  title: 'Components/每日練習/SubjectPracticeButton',
  component: SubjectPracticeButton,
  parameters: { ...pageParameters('/difficult') },
  args: { questions: fixtureSubjectQuestions('law'), subject: 'law', source: 'difficult', loading: false,
    wrongCounts: Object.fromEntries(fixtureSubjectQuestions('law').slice(0, 3).map((question, index) => [question.id, index + 1])) },
  argTypes: {
    questions: { control: false }, subject: { control: false }, wrongCounts: { control: false },
    source: { options: ['difficult', 'wrong'], control: { type: 'select', labels: { difficult: '難題標記', wrong: '常錯題目' } } },
  },
} satisfies Meta<typeof SubjectPracticeButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const 本科目整組重練: Story = {};
