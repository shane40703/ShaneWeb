import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { HistoryPage } from '@/features/history/history-page';
import type { SubjectId } from '@/lib/types';
import HistoryRoute from '@/pages/history';
import { DAILY_PRACTICE_RECORD_PREFIX } from '@/features/practice/daily-practice-recording';
import { mockExamSavedData } from '../../fixtures/mock-exam';
import {
  allLawYearAttempts,
  attemptsAppState,
  legacyMixedAttempt,
  loadedPapersOf,
  perfectAttempts,
  personalAttempts,
  personalDifficultIds,
  personalNoteImages,
  personalNotes,
  questionBankStatusesWith,
} from '../../fixtures/personal';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { withPersonalFrame } from '../personal/personal-frame';

/**
 * 歷屆試題作答履歷（/history）：網站的頁面元件，只載入作答紀錄用到的科目與年度。
 *
 * 畫面上可以操作看到：
 * - 上方切換科目；「每次作答紀錄」與「跨年度錯題分析」兩個分頁。
 * - 只顯示歷屆試題紀錄，每日抽題練習不計入科目次數與錯題分析。
 * - 每個年度都有獨立外框，預設收合，點開看每次的分數與作答時間；
 *   裡面的試卷與每次紀錄只用線條區隔，不再加第二層框。
 * - 「查看完整作答紀錄」看逐題的對錯與答錯次數，
 *   每題的「顯示詳解與討論」打開投稿區；「錯題統計結果」看這次答錯的分類。
 * - 「清除第 N 次紀錄」跳出確認視窗。
 * - 模擬考「再做一次」直接建立同科目、同年度的新作答進度並開啟第 1 題，不再經過選卷；
 *   展開 101 年可測試覆蓋未完成進度前的確認。跨頁導覽只記錄到 Actions，不切換故事。
 * - 工具列「雲端同步」切到雲端狀態時，詳解與討論改從雲端讀取，會一直停在載入中
 *   （Storybook 不會連到 Firebase）。
 */
const meta = {
  title: 'Layouts/歷屆試題作答履歷/作答紀錄清單',
  component: HistoryRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/history') },
} satisfies Meta<typeof HistoryRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 四科都有的作答紀錄：法規 113 年模擬考做了兩次、101 年一次，其他科各一次；
 * 存檔也含新舊每日抽題練習，確認這頁不會混入，且不會刪除它們。
 * 下方是「繼續作答」下一個還沒做的年度。
 */
export const 作答紀錄: Story = {
  parameters: {
    appState: {
      ...attemptsAppState([
        ...personalAttempts,
        ...personalAttempts.filter(attempt => attempt.mode === 'practice').map(attempt => ({
          ...attempt, id: DAILY_PRACTICE_RECORD_PREFIX + attempt.id,
        })),
      ]),
      difficultQuestionIds: personalDifficultIds,
      notes: personalNotes,
      noteImages: personalNoteImages,
    },
    localStorage: mockExamSavedData.localStorage,
  },
};

export const 還沒有作答紀錄: Story = {};

/**
 * 每次都全部答對：沒有「錯題統計結果」，完整作答紀錄沒有分頁切換，
 * 跨年度錯題分析顯示沒有錯題。
 */
export const 全部答對: Story = {
  parameters: { appState: attemptsAppState(perfectAttempts) },
};

/**
 * 長期使用的紀錄：法規每個收錄年度（100–114 年）都做過，下方改成「已完成所有年度」。
 * 範例題庫只有 101、113、114 年，其他年度就像題目已從題庫移除：展開 112 年看只剩分數的
 * 紀錄，跨年度錯題分析下方說明有幾次答錯無法還原。另有一筆舊版留下的跨科目紀錄：
 * 點「跨科目」，紀錄歸在「跨年度試題」，分數顯示「無法計算分數」。
 */
export const 已完成所有年度: Story = {
  parameters: {
    appState: attemptsAppState([...allLawYearAttempts, legacyMixedAttempt]),
  },
};

/** 四科的作答紀錄再加上一筆舊版留下的跨科目紀錄（科目 mixed）。 */
const mixedAttempts = [...personalAttempts, legacyMixedAttempt];
const mixedQuestionIds = mixedAttempts.flatMap((attempt) => attempt.questionIds);

/** 用頁面的 props 固定題庫狀態：環控與構造的題目已載入，法規與結構的還在下載或下載失敗。 */
function HistoryBankStates({
  bank,
  onRetryQuestionBank,
}: {
  bank: 'loading' | 'error';
  onRetryQuestionBank: (subjectId: SubjectId) => void;
}) {
  const statuses = questionBankStatusesWith({ law: bank, structure: bank });
  return (
    <HistoryPage
      questions={loadedPapersOf(mixedQuestionIds, statuses)}
      questionBankStatuses={statuses}
      onRetryQuestionBank={onRetryQuestionBank}
    />
  );
}

/**
 * 法規與結構的題目還沒下載好（用頁面的 props 固定狀態），Controls 的 bank 切換載入中或
 * 載入失敗。展開年度看每次紀錄的「內容載入中」或「重新載入題目」；歷屆試題的「再做一次」
 * 不需等待題目載入。跨年度錯題分析顯示載入中或無法顯示。點「跨科目」再切到
 * 跨年度錯題分析，看已載入一部分時的「尚有 N 次答錯內容載入中／暫時無法顯示」。
 */
export const 題庫載入中或失敗: StoryObj<typeof HistoryBankStates> = {
  parameters: { appState: attemptsAppState(mixedAttempts) },
  decorators: [withPersonalFrame],
  render: (args) => <HistoryBankStates {...args} />,
  args: { bank: 'loading', onRetryQuestionBank: fn() },
  argTypes: {
    bank: {
      options: ['loading', 'error'],
      control: {
        type: 'select',
        labels: { loading: '載入中', error: '載入失敗' },
      },
    },
  },
};
