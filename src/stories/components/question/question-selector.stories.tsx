import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { QuestionSelector } from '@/components/question-selector';
import { subjects, years } from '@/question-bank/catalog';
import { fixtureOptions } from '../../fixtures/question';

/** 實際網站每科都有 100–114 年的題庫，年度按鈕全部可選。 */
const allYearOptions = years.map((year) => ({ value: year }));

const yearOptions = fixtureOptions(
  {
    '全部年度（考古題討論版、筆記）': allYearOptions,
    '只有 113、108、101 年有資料（我的難題、常錯題目）': years.map((year) => ({
      value: year,
      disabled: ![113, 108, 101].includes(year),
    })),
    '最前面加「跨年度」（歷屆試題資料集成）': [
      { value: 'all' as const, label: '跨年度' },
      ...allYearOptions,
    ],
  },
  '全部年度（考古題討論版、筆記）',
);

/**
 * 考古題討論版、筆記頁、我的難題、常錯題目、歷屆試題資料集成共用的科目與年度選擇。
 *
 * 畫面上可以操作看到：點科目、點年度切換（Controls 的 subjectId、year 跟著變）。
 * 用 Controls 換年度選項（我的難題的停用年度、歷屆試題資料集成的跨年度）、勾選停用的科目
 * （disabledSubjectIds）。
 */
const meta = {
  title: 'Components/題目/QuestionSelector',
  component: QuestionSelector,
  args: {
    subjectId: 'law',
    year: 114,
    yearOptions: yearOptions.initial,
    disabledSubjectIds: [],
    onSubjectChange: fn(),
    onYearChange: fn(),
    ariaLabel: '題目選擇',
  },
  argTypes: {
    subjectId: { control: 'select', options: subjects.map((subject) => subject.id) },
    year: { control: 'select', options: ['all', ...years] },
    yearOptions: yearOptions.argType,
    disabledSubjectIds: {
      control: {
        type: 'check',
        labels: Object.fromEntries(
          subjects.map((subject) => [subject.id, subject.shortName]),
        ),
      },
      options: subjects.map((subject) => subject.id),
    },
    // 網站目前的頁面都沒有在選擇器裡放題號、摘要或按鈕。
    questionPicker: { control: false },
    summary: { control: false },
    action: { control: false },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <QuestionSelector
        {...args}
        onSubjectChange={(subjectId) => {
          args.onSubjectChange(subjectId);
          updateArgs({ subjectId });
        }}
        onYearChange={(year) => {
          args.onYearChange(year);
          updateArgs({ year });
        }}
      />
    );
  },
} satisfies Meta<typeof QuestionSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一打開是最新的 114 年法規。 */
export const 科目與年度: Story = {};
