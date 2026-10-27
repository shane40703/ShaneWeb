import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { WrongPage } from '@/features/wrong/wrong-page';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import type { SubjectId } from '@/lib/types';
import WrongRoute from '@/pages/wrong';
import {
  attemptsAppState,
  loadedPapersOf,
  perfectAttempts,
  personalAttempts,
  personalDifficultIds,
  personalNoteImages,
  personalNotes,
  questionBankStatusesWith,
} from '../../fixtures/personal';
import { withExplanation } from '../../fixtures/questions';
import { practiceDiscussionPosts } from '../../fixtures/practice';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 常錯題目（/wrong）：網站的頁面元件，依每次交卷的紀錄統計每題累計答錯幾次，
 * 只載入作答紀錄用到的科目與年度。
 *
 * 畫面上可以操作看到：
 * - 上方切換科目與年度（沒有錯題的科目、年度不能點）。
 * - 「練習本科目常錯題目」先開啟題數設定；可隨機抽取指定題數，或選全部跨年度錯題。
 * - 「查看選項、重新作答與詳解」展開選項、詳解與這題的我的筆記；選答案後按「檢查答案」
 *   看答對或答錯，「重新作答」再選一次。
 * - 展開後的筆記可以編輯、上傳圖片；題目上的難題按鈕可以標記或取消難題。
 */
const meta = {
  title: 'Layouts/常錯題目/錯題清單',
  component: WrongRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/wrong') },
} satisfies Meta<typeof WrongRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 四科都有的交卷紀錄（法規 113 年做了兩次、還有每日抽題練習），幾題標成難題、寫了筆記。 */
const wrongAppState = {
  ...attemptsAppState(personalAttempts),
  difficultQuestionIds: personalDifficultIds,
  notes: personalNotes,
  noteImages: personalNoteImages,
};
const wrongAttempts = wrongAppState.attempts ?? [];

/** 頁面只載入有作答的題目所在的試卷（答錯一定有作答）。 */
const answeredIds = personalAttempts.flatMap((attempt) => Object.keys(attempt.answers));

/**
 * 四科都有交卷紀錄，一開始是法規 113 年：兩次模擬考加上每日抽題練習，依答錯次數排列
 * （三次都錯的排最前面）。法規 101 年有截圖的第 15 題與題幹含圖片的第 8 題；
 * 環控、構造、結構只做過一次，每題都只錯 1 次。
 */
export const 多次答錯: Story = {
  parameters: { appState: wrongAppState },
};

export const 還沒有作答紀錄: Story = {};

/** 有交卷紀錄但全部答對。 */
export const 沒有答錯題目: Story = {
  parameters: { appState: attemptsAppState(perfectAttempts) },
};

/**
 * 題庫有內建詳解時（實際題庫目前都沒有詳解）：展開第 5 題看詳解區，其他題仍是
 * 「目前尚無詳解。」（用頁面的 props 換掉第 5 題）。
 */
export const 有詳解的錯題: Story = {
  parameters: { appState: wrongAppState },
  render: () => (
    <WrongPage
      attempts={wrongAttempts}
      questions={loadedPapersOf(answeredIds).map((question) =>
        question.id === 'law-113-05'
          ? withExplanation(
              question,
              '依**建築法第 56 條**，建築工程中必須勘驗部分，由承造人會同_監造人_按時申報後，方得繼續施工。',
            )
          : question,
      )}
      questionBankStatuses={questionBankStatusesWith()}
      onRetryQuestionBank={fn()}
    />
  ),
};

/** 展開法規 113 年第 5 題，查看共享的文字詳解與圖片。 */
export const 有共享詳解的錯題: Story = {
  parameters: {
    appState: {
      ...wrongAppState,
      discussionPosts: practiceDiscussionPosts('law-113-05').slice(0, 1).map(post => ({
        ...post, content: '這題的**共享詳解**與整理圖片會直接顯示在錯題下方。',
      })),
    },
  },
};

/** 各科題庫的下載狀態，沒列出的科目已下載完成。 */
const bankScenarios = {
  partial: { env: 'loading', construction: 'error' },
  loading: {
    law: 'loading',
    env: 'loading',
    construction: 'loading',
    structure: 'loading',
  },
  error: { law: 'error', env: 'error', construction: 'error', structure: 'error' },
} satisfies Record<string, Partial<Record<SubjectId, QuestionBankStatus>>>;

/** 用頁面的 props 固定題庫狀態：已下載完成的科目照頁面載入整份試卷。 */
function WrongBankStates({
  bank,
  onRetryQuestionBank,
}: {
  bank: keyof typeof bankScenarios;
  onRetryQuestionBank: (subjectId: SubjectId) => void;
}) {
  const statuses = questionBankStatusesWith(bankScenarios[bank]);
  return (
    <WrongPage
      attempts={wrongAttempts}
      questions={loadedPapersOf(answeredIds, statuses)}
      questionBankStatuses={statuses}
      onRetryQuestionBank={onRetryQuestionBank}
    />
  );
}

/**
 * 題庫還沒下載好（用頁面的 props 固定狀態）。Controls 的 bank 切換：
 * 「環控載入中、構造載入失敗」上方兩個提示，已載入的法規與結構照常顯示；
 * 「全部載入中」是「正在整理常錯題目」；「全部載入失敗」是錯題內容暫時無法顯示。
 * 「重新載入」記在 Actions。
 */
export const 題庫載入中或失敗: StoryObj<typeof WrongBankStates> = {
  parameters: { appState: wrongAppState },
  render: (args) => <WrongBankStates {...args} />,
  args: { bank: 'partial', onRetryQuestionBank: fn() },
  argTypes: {
    bank: {
      options: Object.keys(bankScenarios),
      control: {
        type: 'select',
        labels: {
          partial: '環控載入中、構造載入失敗',
          loading: '全部載入中',
          error: '全部載入失敗',
        },
      },
    },
  },
};
