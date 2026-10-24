import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import type { QuestionSummary } from '@/lib/types';
import { resourceQuestionSummaries } from '../../fixtures/resources';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/** 跟 src/pages/resources/analysis.tsx 一樣：歷屆試題資料集成的頁首，下面是考題分析。 */
function AnalysisRoute({ questions }: { questions: QuestionSummary[] }) {
  return (
    <ResourceLayout current="analysis">
      <AnalysisPage questions={questions} />
    </ResourceLayout>
  );
}

/**
 * 考題分析（/resources/analysis）：選科目與年度後看命題分布、對應考古題與詳細趨勢分析。
 * 題目摘要來自範例題庫（法規 101、113、114 年；環控、構造、結構 113 年），其他年度在
 * 選單裡是停用的。網址沒有參數時跟網站一樣顯示法規最新一年（114 年）。
 *
 * 畫面上可以操作看到：
 * - 切換科目：法規依相關法規統計，其他科目依命題分類統計，沒出題的分類也列出（0 題），
 *   例如環控的「規範」，點下去右側沒有考古題、「到每日抽題練習抽題」停用。
 * - 年度選「跨年度」：多出起訖年度選單，預設是題庫最舊到最新的 101～114 年。
 * - 點命題分布裡的其他分類：右側改列這個分類的考古題。
 * - 展開頁面最下方的「詳細趨勢分析」：折線圖、各年度題數與 115 年複習優先度，
 *   可以勾選比較的分類、法規可以把分析層級切到「人工細分考點」。
 *
 * 「到每日抽題練習抽題」會換到每日抽題練習頁，在故事裡只記錄在 Actions 面板。
 */
const meta = {
  title: 'Layouts/考題分析/分析畫面',
  component: AnalysisRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...pageParameters('/resources/analysis') },
  args: { questions: resourceQuestionSummaries },
} satisfies Meta<typeof AnalysisRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 範例題庫: Story = {};

/** 網址指定題庫沒有題目的年度（法規 112 年，選單裡是停用的）：顯示尚無分析資料。 */
export const 尚無分析資料: Story = {
  parameters: {
    ...pageParameters('/resources/analysis', { subject: 'law', year: '112' }),
  },
};
