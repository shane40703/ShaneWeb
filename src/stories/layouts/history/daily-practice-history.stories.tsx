import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DailyPracticeHistoryRoute from '@/pages/practice-history';
import { DAILY_PRACTICE_RECORD_PREFIX } from '@/features/practice/daily-practice-recording';
import { attemptsAppState, personalAttempts, personalNotes, personalNoteImages } from '../../fixtures/personal';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 每日練習履歷只顯示使用者明確儲存的每日抽題練習。
 * 這些紀錄不會重複列入「歷屆試題作答履歷」；兩頁的科目次數與錯題分析分開計算。
 * 展開題組看作答日期、題數、正確率與時間；「查看完整作答紀錄」看答案、詳解、筆記。
 * 「刪除第 N 次紀錄」先開啟確認視窗，可取消或刪除；其他模式與既有紀錄不受影響。
 * 切換科目與結果分頁、展開詳解及刪除都可以直接操作。主題與寬度由工具列切換。
 */
const meta = {
  title: 'Layouts/每日練習履歷/履歷清單',
  component: DailyPracticeHistoryRoute,
  decorators: [withPageFrame],
  parameters: { ...pageParameters('/practice-history') },
} satisfies Meta<typeof DailyPracticeHistoryRoute>;
export default meta;
type Story = StoryObj<typeof meta>;

const dailyAttempts = personalAttempts.filter(attempt => attempt.mode === 'practice').map(attempt => ({
  ...attempt, id: DAILY_PRACTICE_RECORD_PREFIX + attempt.id,
}));

export const 已儲存的練習: Story = {
  parameters: {
    appState: {
      ...attemptsAppState([...dailyAttempts, ...personalAttempts]),
      notes: personalNotes,
      noteImages: personalNoteImages,
    },
  },
};

/** 舊版作答紀錄仍保留，但未經明確儲存的紀錄不會自動搬入新履歷。 */
export const 尚未儲存任何練習: Story = {
  parameters: { appState: attemptsAppState(personalAttempts) },
};
