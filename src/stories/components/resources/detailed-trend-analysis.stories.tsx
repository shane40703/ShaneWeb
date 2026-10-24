import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { DetailedTrendAnalysis } from '@/features/analysis/detailed-trend-analysis';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import { subjects, years } from '@/question-bank/catalog';
import {
  resourceQuestionSummaries,
  summariesWithoutFineTopic,
} from '../../fixtures/resources';

/** 跟 analysis-page.tsx 傳給趨勢分析的配色一樣。 */
const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

/** 跟 analysis-page.tsx 一樣：比較這個科目在題庫裡有題目的年度，由舊到新。 */
function trendYearsOf(questions: readonly QuestionSummary[], subjectId: SubjectId) {
  return years
    .filter((year) =>
      questions.some(
        (question) => question.subject === subjectId && question.year === year,
      ),
    )
    .reverse();
}

/**
 * 年度照考題分析頁由科目決定。一開始就展開（跟點一下標題列一樣），點標題列可以收合。
 */
function ExpandedTrendAnalysis({
  questions,
  subjectId,
  colors,
}: ComponentProps<typeof DetailedTrendAnalysis>) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    container.current?.querySelector('details')?.setAttribute('open', '');
  }, []);
  return (
    <div ref={container}>
      <DetailedTrendAnalysis
        questions={questions}
        subjectId={subjectId}
        years={trendYearsOf(questions, subjectId)}
        colors={colors}
      />
    </div>
  );
}

/**
 * 考題分析頁最下方的「詳細趨勢分析」：勾選分類比較歷年題數、看 115 年複習優先度。
 * 範例題庫的法規有 101、113、114 三個年度，其他科目只有 113 年。
 *
 * 畫面上可以操作看到：
 * - 點標題列收合或展開；一開始勾選題數最多的三項法規。
 * - 勾選比較的分類：全部取消時折線圖提示先勾選分類、統計顯示「—」；勾滿 6 項後其他項目停用。
 * - 「分析層級」切到「人工細分考點」，調整起訖年度。
 *
 * Controls 的 subjectId 換成其他科目：跟考題分析頁一樣只比較這科有題目的年度（113 年），
 * 依命題分類比較，沒有分析層級選單，折線圖只有一個點。
 */
const meta = {
  title: 'Components/歷屆試題資料集成/DetailedTrendAnalysis',
  component: DetailedTrendAnalysis,
  // 跟考題分析頁一樣，換科目時重新開始，勾選與分析層級回到預設。
  render: (args) => <ExpandedTrendAnalysis key={args.subjectId} {...args} />,
  args: {
    questions: resourceQuestionSummaries,
    subjectId: 'law',
    years: trendYearsOf(resourceQuestionSummaries, 'law'),
    colors: chartColors,
  },
  argTypes: {
    subjectId: {
      options: subjects.map((subject) => subject.id),
      control: {
        type: 'inline-radio',
        labels: Object.fromEntries(
          subjects.map((subject) => [subject.id, subject.shortName]),
        ),
      },
    },
    questions: { control: false },
    // 年度由科目決定，見 trendYearsOf。
    years: { table: { disable: true } },
  },
} satisfies Meta<typeof DetailedTrendAnalysis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 範例題庫: Story = {};

/**
 * 法規題還沒標註人工細分考點：把「分析層級」切到「人工細分考點」，
 * 顯示這個分析層級目前沒有可用資料。
 */
export const 未標註細分考點: Story = {
  args: { questions: summariesWithoutFineTopic },
};
