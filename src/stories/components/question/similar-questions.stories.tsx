import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SimilarQuestions } from '@/components/similar-questions';
import { fixtureOptions } from '../../fixtures/question';
import { fixtureQuestions, getFixtureQuestion } from '../../fixtures/questions';

/**
 * Controls 的 question：範例題庫裡同考點題數不同的法規題。四題同考點是 101 年第 39 題（都市更新）、
 * 五題同考點是 113 年第 13 題（農舍）、只有一題是 114 年第 1 題（建築基地及法定空地，只有 113 年
 * 第 3 題）、沒有其他題是 114 年第 22 題（採光）。選項名稱用英文，網址才記得住選擇。
 */
const questionOptions = fixtureOptions(
  {
    four: getFixtureQuestion('law-101-39'),
    five: getFixtureQuestion('law-113-13'),
    one: getFixtureQuestion('law-114-01'),
    none: getFixtureQuestion('law-114-22'),
  },
  'four',
);

/**
 * 考古題討論版題目分頁與我的筆記頁的類似考題：同一個考點的其他法規題，最新年度在前，
 * 每一列連到那一題。超過 8 題時先列最近 8 題，按「顯示全部」展開；考點沒有其他題時只有一行說明。
 * 元件本身沒有外框，由頁面的面板框起來（這裡用同樣的奶油紙框示意）。
 * 用 Controls 的 basePath 切換連到考古題討論版（/exams）或筆記頁（/notes），外觀相同。
 */
const meta = {
  title: 'Components/題目/SimilarQuestions',
  component: SimilarQuestions,
  args: {
    question: questionOptions.initial,
    questions: fixtureQuestions,
    basePath: '/exams',
  },
  argTypes: {
    question: {
      ...questionOptions.argType,
      control: {
        type: 'select',
        labels: {
          four: '四題同考點',
          five: '五題同考點',
          one: '只有一題',
          none: '沒有其他題',
        },
      },
    },
    basePath: { control: 'inline-radio', options: ['/exams', '/notes'] },
    questions: { control: false, table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 820,
          padding: 24,
          border: 'var(--frame)',
          borderRadius: 'var(--radius-frame)',
          background: 'var(--surface)',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SimilarQuestions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 類似考題: Story = {};
