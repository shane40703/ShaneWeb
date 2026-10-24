import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { QuestionNumberPicker } from '@/components/question-selector';
import { comparePaperQuestionOrder, formatQuestionNumberLabel } from '@/lib/study';
import type { Question } from '@/lib/types';
import { fixtureOptions, law101Questions } from '../../fixtures/question';
import { fixtureQuestionsFor } from '../../fixtures/questions';

/** 跟考古題討論版頁一樣，把題目轉成題號選項。 */
function pickerQuestions(
  questions: readonly Question[],
  difficultIds: readonly string[],
  contentIds: readonly string[],
) {
  return [...questions].sort(comparePaperQuestionOrder).map((question) => ({
    id: question.id,
    questionNumber: question.questionNumber,
    label: formatQuestionNumberLabel(question, true),
    ariaLabel: formatQuestionNumberLabel(question),
    difficult: question.format !== 'written' && difficultIds.includes(question.id),
    hasContent: contentIds.includes(question.id),
  }));
}

const questionOptions = fixtureOptions(
  {
    '101 年法規': pickerQuestions(
      law101Questions,
      ['law-101-08', 'law-101-15', 'law-101-27', 'law-101-40'],
      ['law-101-03', 'law-101-15', 'law-101-21', 'law-101-39', 'law-101-62'],
    ),
    '113 年結構（申論題排在前面）': pickerQuestions(
      fixtureQuestionsFor('structure', 113),
      ['structure-113-03', 'structure-113-21'],
      ['structure-113-written-01', 'structure-113-16'],
    ),
    沒有難題與詳解: pickerQuestions(law101Questions, [], []),
  },
  '101 年法規',
);

/**
 * 考古題討論版右側的題號導覽：紫點是有詳解或討論、橘色是我的難題，下方是標記說明。
 *
 * 畫面上可以操作看到：點題號換目前題目（Controls 的 value 跟著變）。
 * 用 Controls 換試卷（含申論題的「申1」「申2」、沒有任何標記）、隱藏標記說明。
 */
const meta = {
  title: 'Components/題目/QuestionNumberPicker',
  component: QuestionNumberPicker,
  args: {
    questions: questionOptions.initial,
    value: 'law-101-15',
    onValueChange: fn(),
    showStatusLegend: true,
  },
  argTypes: { questions: questionOptions.argType },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    // 換試卷後原本的題號不在新試卷裡時，跟考古題討論版一樣停在第一題。
    const value = args.questions.some((question) => question.id === args.value)
      ? args.value
      : (args.questions[0]?.id ?? '');
    return (
      <QuestionNumberPicker
        {...args}
        value={value}
        onValueChange={(questionId) => {
          args.onValueChange(questionId);
          updateArgs({ value: questionId });
        }}
      />
    );
  },
} satisfies Meta<typeof QuestionNumberPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 考古題討論版題號導覽: Story = {};
