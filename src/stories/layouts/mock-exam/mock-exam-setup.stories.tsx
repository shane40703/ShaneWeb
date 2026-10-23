import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { MockExamPaper } from '@/features/practice/mock-exam';
import { MockExamPage } from '@/features/practice/mock-exam-page';
import { mockExamPapers, mockExamSavedData } from '../../fixtures/mock-exam';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { withMockExamFrame } from './mock-exam-frame';

/** Controls 的 papers 選單：網站目前四科都有試卷，另外兩種只有題庫缺科目時才看得到。 */
const paperChoices: Record<string, MockExamPaper[]> = {
  全部試卷: mockExamPapers,
  結構還沒有試卷: mockExamPapers.filter((paper) => paper.subject !== 'structure'),
  沒有試卷: [],
};

/**
 * /practice/mock-exam 的選卷畫面，試卷清單照 getStaticProps 算（fixtures/mock-exam.ts）。
 * 瀏覽器裡存著法規 101 年（上次交過卷，正在重考）與 109 年的作答進度，法規 113 年、結構
 * 113 年、構造 113 年（全部答對）交過卷。
 *
 * 畫面上可以操作看到：
 * - 點年度：113 年（上次成績與「查看結果」）、114 年（沒作答過，「開始作答」）、
 *   112 年（範例題庫沒有題目，開始作答後是「找不到這一題」）。
 * - 選科目：環控、結構（試卷另有申論題的提示；結構 113 年有上次成績）、構造（113 年上次
 *   100 分）。
 * - 繼續作答、開始作答（作答畫面）、查看結果（作答結果）、重新開始（先確認）。
 * - Controls 的 papers：結構還沒有試卷（科目顯示「準備中」）、沒有試卷。
 */
const meta = {
  title: 'Layouts/歷屆試題模擬考/選卷',
  component: MockExamPage,
  decorators: [withMockExamFrame, withStatefulRouter, withPageFrame],
  parameters: {
    ...pageParameters('/practice/mock-exam', { subject: 'law', year: '101' }),
    ...mockExamSavedData,
  },
  argTypes: {
    papers: {
      control: 'select',
      options: Object.keys(paperChoices),
      mapping: paperChoices,
    },
  },
  // Controls 存的是選項名稱，Storybook 畫故事前照 mapping 換成試卷清單。
  args: { papers: '全部試卷' as unknown as MockExamPaper[] },
} satisfies Meta<typeof MockExamPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 有作答紀錄: Story = {};

/** 頁面剛打開、還沒讀到網址參數。 */
export const 載入中: Story = {
  parameters: { nextjs: { router: { isReady: false } } },
};
