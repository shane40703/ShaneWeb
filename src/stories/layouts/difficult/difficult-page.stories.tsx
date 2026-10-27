import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { DifficultPage } from '@/features/difficult/difficult-page';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import type { SubjectId } from '@/lib/types';
import DifficultRoute from '@/pages/difficult';
import {
  loadedPapersOf,
  personalDifficultIds,
  personalNoteImages,
  personalNotes,
  questionBankStatusesWith,
} from '../../fixtures/personal';
import { withExplanation } from '../../fixtures/questions';
import { practiceDiscussionPosts } from '../../fixtures/practice';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 難題標記（/difficult）：網站的頁面元件，只載入有標記難題的科目與年度。
 *
 * 畫面上可以操作看到：
 * - 上方切換科目與年度（沒有難題的科目、年度不能點）。
 * - 「練習本科目難題標記」先開啟題數設定，可自訂或選全部，再導向每日抽題練習。
 * - 「查看選項、作答與詳解」展開選項、詳解與這題的我的筆記；選答案後按「檢查答案」看
 *   答對或答錯，「重新作答」再選一次。
 * - 展開後的筆記可以編輯、上傳圖片；題目上的難題按鈕可以取消標記。
 */
const meta = {
  title: 'Layouts/難題標記/難題清單',
  component: DifficultRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/difficult') },
} satisfies Meta<typeof DifficultRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 四科都有標記的難題，筆記沿用我的筆記頁的範例資料。 */
const markedAppState = {
  difficultQuestionIds: personalDifficultIds,
  notes: personalNotes,
  noteImages: personalNoteImages,
};

/**
 * 四科都有標記的難題，一開始是法規 113 年（第 27 題的筆記有圖片）。法規 101 年有截圖的
 * 第 15 題與題幹含圖片、還沒寫筆記的第 8 題；結構 113 年第 5 題也還沒寫筆記。
 */
export const 多科難題: Story = {
  parameters: { appState: markedAppState },
};

export const 還沒有標記難題: Story = {};

/**
 * 題庫有內建詳解時（實際題庫目前都沒有詳解）：展開第 3 題看詳解區，其他題仍是
 * 「目前尚無詳解。」（用頁面的 props 換掉第 3 題）。
 */
export const 有詳解的難題: Story = {
  parameters: { appState: markedAppState },
  render: () => (
    <DifficultPage
      questions={loadedPapersOf(personalDifficultIds).map((question) =>
        question.id === 'law-113-03'
          ? withExplanation(
              question,
              '依**建築法第 44 條**，基地面積畸零狹小不合規定者，非與鄰接土地協議調整地形或合併使用，達到規定最小面積之寬度及深度，_不得建築_。',
            )
          : question,
      )}
      questionBankStatuses={questionBankStatusesWith()}
      onRetryQuestionBank={fn()}
    />
  ),
};

/** 沒有內建詳解也能讀取共享文字與圖片；展開法規 113 年第 3 題查看。 */
export const 有共享詳解的難題: Story = {
  parameters: {
    appState: {
      ...markedAppState,
      discussionPosts: practiceDiscussionPosts('law-113-03').slice(0, 1).map(post => ({
        ...post, content: '這是使用者分享的**解題重點**，也可以一起檢視附上的整理圖片。',
      })),
    },
  },
};

/** 標記的題目已從題庫移除（範例題庫沒有 112 年）。 */
export const 難題內容無法顯示: Story = {
  parameters: {
    appState: { difficultQuestionIds: ['law-112-07', 'law-112-31'] },
  },
};

/** 各科題庫的下載狀態，沒列出的科目已下載完成。 */
const bankScenarios = {
  partial: { env: 'loading', structure: 'error' },
  loading: {
    law: 'loading',
    env: 'loading',
    construction: 'loading',
    structure: 'loading',
  },
  error: { law: 'error', env: 'error', construction: 'error', structure: 'error' },
} satisfies Record<string, Partial<Record<SubjectId, QuestionBankStatus>>>;

/** 用頁面的 props 固定題庫狀態：已下載完成的科目照頁面載入整份試卷。 */
function DifficultBankStates({
  bank,
  onRetryQuestionBank,
}: {
  bank: keyof typeof bankScenarios;
  onRetryQuestionBank: (subjectId: SubjectId) => void;
}) {
  const statuses = questionBankStatusesWith(bankScenarios[bank]);
  return (
    <DifficultPage
      questions={loadedPapersOf(personalDifficultIds, statuses)}
      questionBankStatuses={statuses}
      onRetryQuestionBank={onRetryQuestionBank}
    />
  );
}

/**
 * 題庫還沒下載好（用頁面的 props 固定狀態）。Controls 的 bank 切換：
 * 「環控載入中、結構載入失敗」上方兩個提示，已載入的法規與構造照常顯示；
 * 「全部載入中」「全部載入失敗」只剩上方的提示。「重新載入」記在 Actions。
 */
export const 題庫載入中或失敗: StoryObj<typeof DifficultBankStates> = {
  parameters: { appState: markedAppState },
  render: (args) => <DifficultBankStates {...args} />,
  args: { bank: 'partial', onRetryQuestionBank: fn() },
  argTypes: {
    bank: {
      options: Object.keys(bankScenarios),
      control: {
        type: 'select',
        labels: {
          partial: '環控載入中、結構載入失敗',
          loading: '全部載入中',
          error: '全部載入失敗',
        },
      },
    },
  },
};
