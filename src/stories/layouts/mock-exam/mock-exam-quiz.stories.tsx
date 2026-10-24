import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { mockExamHref } from '@/features/practice/mock-exam';
import { MockExamPage } from '@/features/practice/mock-exam-page';
import { MockExamQuiz } from '@/features/practice/mock-exam-quiz';
import { createPracticeTimer } from '@/features/practice/practice-session';
import {
  law101Draft,
  mockExamPaper,
  mockExamPapers,
  mockExamSavedData,
} from '../../fixtures/mock-exam';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { MockExamPageRoot, withMockExamFrame } from './mock-exam-frame';

/**
 * /practice/mock-exam 作答中的畫面：網址的 q 是第幾題，瀏覽器裡存著這份試卷的作答進度
 * （跟選卷、作答結果同一份存檔）。法規 101 年作答到第 15 題（建築法第 5 條），選了 D 並
 * 刪去 B、C；第 8、11 題跳過；第 3、12、15、41 題標為難題。
 *
 * 畫面上可以操作看到：
 * - 作答區填滿可用頁寬；選答案後再點一次取消，選項之間有淺色分隔線。
 * - 刪去或恢復選項（選項右邊的眼睛）、標為難題。
 * - 上一題／下一題（第 16 題起都沒作答）、點題號導覽換題（8：題幹有圖片；80：最後一題，
 *   「下一題」換成「交卷」）。
 * - 交卷：確認有未作答後到作答結果。
 * - 先離開（回到選卷）：從那裡點 114 年「開始作答」是全新的第 1 題；點 112 年「開始作答」
 *   是題庫裡找不到這一題（範例題庫沒有 112 年）。
 */
const meta = {
  title: 'Layouts/歷屆試題模擬考/作答畫面',
  component: MockExamPage,
  decorators: [withMockExamFrame, withStatefulRouter, withPageFrame],
  parameters: {
    ...pageParameters('/practice/mock-exam', { subject: 'law', year: '101', q: '15' }),
    ...mockExamSavedData,
  },
  argTypes: { papers: { table: { disable: true } } },
  args: { papers: mockExamPapers },
} satisfies Meta<typeof MockExamPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 作答中: Story = {};

const law101 = mockExamPaper('law', 101);

/**
 * 直接用 MockExamQuiz 畫法規 101 年，題目還沒拿到。跟頁面一樣由網址的 q 決定第幾題：
 * 點題號導覽會換題號，題目一樣拿不到。
 */
function QuizWithoutQuestion({ status }: { status: 'loading' | 'error' }) {
  const router = useRouter();
  const [timer] = useState(createPracticeTimer);
  const position = Number(router.query.q);
  const index =
    Number.isInteger(position) && position >= 1 && position <= law101.questionCount
      ? position - 1
      : 0;
  function goTo(next: number) {
    const q = Math.max(0, Math.min(next, law101.questionCount - 1)) + 1;
    void router.replace(mockExamHref({ subject: 'law', year: 101, q }), undefined, {
      shallow: true,
      scroll: false,
    });
  }
  return (
    <MockExamPageRoot answering>
      <MockExamQuiz
        paper={law101}
        question={undefined}
        status={status}
        index={index}
        progress={law101Draft}
        timer={timer}
        canSubmit={false}
        onRetry={fn()}
        onSelect={fn()}
        onToggleEliminated={fn()}
        onGoTo={goTo}
        onSubmit={fn()}
        onLeave={fn()}
      />
    </MockExamPageRoot>
  );
}

/**
 * 題庫還在下載或下載失敗（作答進度仍保存，可以重新載入）。網站會快取題庫，故事裡等不到
 * 這兩種狀態，所以直接用 MockExamQuiz 的 status，在 Controls 切換。
 */
export const 題目沒載入: StoryObj<typeof QuizWithoutQuestion> = {
  render: (args) => <QuizWithoutQuestion {...args} />,
  args: { status: 'loading' },
  argTypes: {
    status: {
      options: ['loading', 'error'],
      control: { type: 'inline-radio', labels: { loading: '載入中', error: '載入失敗' } },
    },
  },
};
