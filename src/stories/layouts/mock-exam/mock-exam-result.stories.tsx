import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { MockExamPage } from '@/features/practice/mock-exam-page';
import { MockExamResult } from '@/features/practice/mock-exam-result';
import type { SubjectId } from '@/lib/types';
import {
  law101Attempt,
  mockExamPaper,
  mockExamPaperQuestions,
  mockExamPapers,
  mockExamSavedData,
} from '../../fixtures/mock-exam';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { MockExamPageRoot, withMockExamFrame } from './mock-exam-frame';

function resultUrl(subject: SubjectId, year: number, result: string) {
  return pageParameters('/practice/mock-exam', { subject, year: String(year), result });
}

/**
 * /practice/mock-exam 交卷後的畫面：網址的 result 是已作答紀錄裡這次成績的 id，題目照常
 * 從題庫載入（跟選卷、作答畫面同一份存檔）。法規 101 年答錯 8 題，5 題沒作答（其中 3 題
 * 一律給分）；第 12、15、41 題第一次考也錯（已答錯 2 次）並標為難題，第 15 題有筆記與圖片。
 *
 * 畫面上可以操作看到：
 * - 「錯題統計結果」分頁、點題號導覽跳到那一題、標為難題。
 * - 每題的「顯示詳解與討論」與「檢視完整選項與筆記」（第 15 題有筆記與圖片）。工具列
 *   「雲端同步」切到雲端時，詳解與討論會一直顯示載入中（Storybook 不連雲端）。
 * - 其他試卷的結果：「選擇其他試卷」→ 選科目與年度 →「查看結果」。
 *   - 法規 113 年：全部作答（答錯 14 題）。
 *   - 結構 113 年：最後 4 題沒作答，未作答不給分。
 *   - 構造 113 年：全部答對，只有一律給分的題目沒作答（不顯示分頁，題號導覽全部標綠）。
 * - 再考一次、選擇其他試卷（回到選卷）。
 */
const meta = {
  title: 'Layouts/歷屆試題模擬考/作答結果',
  component: MockExamPage,
  decorators: [withMockExamFrame, withStatefulRouter, withPageFrame],
  parameters: {
    ...resultUrl('law', 101, law101Attempt.id),
    ...mockExamSavedData,
  },
  argTypes: { papers: { table: { disable: true } } },
  args: { papers: mockExamPapers },
} satisfies Meta<typeof MockExamPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 交卷結果: Story = {};

/** 網址的成績已從已作答紀錄刪除。 */
export const 找不到作答結果: Story = {
  parameters: {
    ...resultUrl('law', 101, 'attempt-2026-10-01T00:00:00.000Z-gone00'),
  },
};

const law101Questions = mockExamPaperQuestions('law', 101);

/** 直接用 MockExamResult 畫上次交卷的法規 101 年，題目的載入狀態由 status 決定。 */
function ResultWithoutQuestions({ status }: { status: 'loading' | 'error' | 'partial' }) {
  return (
    <MockExamPageRoot>
      <MockExamResult
        paper={mockExamPaper('law', 101)}
        attempt={law101Attempt}
        questions={
          status === 'partial'
            ? law101Questions.filter((question) => question.questionNumber > 2)
            : []
        }
        status={status === 'partial' ? 'ready' : status}
        onRetry={fn()}
        onRetake={fn()}
        onChooseAnother={fn()}
      />
    </MockExamPageRoot>
  );
}

/**
 * 分數已經算好，逐題結果等題目：題庫還在下載、下載失敗（可以重新載入），或題庫改版後
 * 少了幾題（其餘照常列出）。網站會快取題庫，故事裡等不到這些狀態，所以直接用
 * MockExamResult 的 props，在 Controls 切換。
 */
export const 逐題結果沒載入: StoryObj<typeof ResultWithoutQuestions> = {
  render: (args) => <ResultWithoutQuestions {...args} />,
  args: { status: 'loading' },
  argTypes: {
    status: {
      options: ['loading', 'error', 'partial'],
      control: {
        type: 'inline-radio',
        labels: { loading: '載入中', error: '載入失敗', partial: '少了第 1、2 題' },
      },
    },
  },
};
