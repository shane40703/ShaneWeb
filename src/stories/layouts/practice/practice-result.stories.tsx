import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { PracticeResultView } from '@/features/practice/practice-result';
import { createRecordablePracticeResult } from '@/features/practice/daily-practice-recording';
import { keepPracticeResult } from '@/features/practice/practice-result-memory';
import {
  createPracticeResult,
  resetPracticeAnswers,
  type PracticeSession,
} from '@/features/practice/practice-session';
import type { AppState } from '@/lib/types';
import PracticeQuizRoute from '@/pages/practice/quiz';
import { FIXTURE_NOW, fixtureImages, fixtureNoteContent } from '../../fixtures/app-state';
import { getFixtureQuestion } from '../../fixtures/questions';
import {
  answerPractice,
  practiceDiscussionPosts,
  practiceSessionOf,
} from '../../fixtures/practice';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import {
  practicePageParameters,
  stayInStoryOnRewind,
  withPracticeResultFrame,
} from './practice-frame';

// 十題的法規題組：含截圖那題（101-15）、題幹有圖的 101-08、題目很長的 113-33。
const questionIds = [
  'law-113-05',
  'law-101-15',
  'law-113-21',
  'law-101-08',
  'law-113-33',
  'law-101-44',
  'law-113-62',
  'law-101-71',
  'law-113-12',
  'law-101-03',
];

// 作答八題（答錯三題），跳過第七、八題，確認最後一題後完成練習。
const mixedSession = answerPractice(
  practiceSessionOf('story-practice-result', questionIds),
  {
    'law-113-05': 'correct',
    'law-101-15': 'wrong',
    'law-113-21': 'correct',
    'law-101-08': 'wrong',
    'law-113-33': 'wrong',
    'law-101-44': 'correct',
    'law-113-12': 'correct',
    'law-101-03': 'correct',
  },
);

const perfectSession = answerPractice(
  practiceSessionOf('story-practice-result-perfect', questionIds),
  Object.fromEntries(questionIds.map((questionId) => [questionId, 'correct' as const])),
);

/**
 * 完成練習後的畫面。網站把成績留在分頁的記憶體裡、題組清成重新作答的狀態，網址是
 * `?view=result`；故事照這樣準備，整頁打開就停在練習結果。
 */
function submitted(session: PracticeSession, appState?: Partial<AppState>): Story {
  const result = createRecordablePracticeResult(session,
    new Map(session.questionIds.map(id => [id, getFixtureQuestion(id)])), FIXTURE_NOW);
  return {
    parameters: {
      ...practicePageParameters(resetPracticeAnswers(session), { view: 'result' }),
      ...(appState ? { appState } : {}),
    },
    beforeEach: () => {
      keepPracticeResult(result);
      return () => keepPracticeResult(null);
    },
  };
}

/**
 * 每日抽題練習完成練習後的練習結果：整個 /practice/quiz 頁面，成績照網站的 createPracticeResult
 * 計算，錯題整理從這科的題庫找題目。結果、錯題整理與考題預覽皆使用整個頁面寬度，手機依容器寬度換行。
 *
 * 畫面上可以操作看到：
 * - 「儲存此次作答」才加入每日練習履歷；「不記錄此次作答」不新增任何作答紀錄。
 *   儲存後顯示履歷入口，不會重複新增；決定不記錄後，在離開前仍能改為儲存。
 * - 「本次考題預覽」展開／收合整份題組（題目與選項順序跟這次練習相同）
 * - 錯題的我的筆記：輸入文字、貼上圖片；筆記圖片點開放大
 * - 錯題完整選項保留本次打亂順序，內容末尾以淡色標註原題選項字母，方便對照詳解
 * - 「重做這組題目」回到作答畫面第 1 題；最後一題先「確認答案」，再按「完成練習」查看新結果
 * - 「重新選科／抽題」回到設定畫面
 */
const meta = {
  title: 'Layouts/每日抽題練習/練習結果',
  component: PracticeQuizRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...pageParameters('/practice/quiz') },
  beforeEach: stayInStoryOnRewind,
} satisfies Meta<typeof PracticeQuizRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 十題作答八題、答錯三題，兩題未作答不計入正確率。錯題整理的第一題（建築法第 5 條）
 * 標成難題，有我的筆記、筆記圖片與其他使用者分享的詳解；另外兩題沒有。
 */
export const 有答錯: Story = submitted(mixedSession, {
  difficultQuestionIds: ['law-101-15'],
  notes: { 'law-101-15': fixtureNoteContent },
  noteImages: { 'law-101-15': fixtureImages.slice(0, 2) },
  discussionPosts: practiceDiscussionPosts('law-101-15'),
});

/** 十題全部答對：錯題整理改成沒有需要檢討的題目。 */
export const 全部答對: Story = submitted(perfectSession);

/**
 * 從每日練習回到結果、題庫還沒讀回來的一瞬間：錯題暫時不顯示，考題預覽不能按。
 * 整頁故事的題庫馬上就載入好，所以這裡直接畫結果畫面、不給題目。
 */
export const 題目尚未載入: StoryObj<{ onRetry: () => void; onNewDraw: () => void }> = {
  render: (args) => (
    <PracticeResultView
      result={createPracticeResult(mixedSession)}
      questionById={new Map()}
      onRetry={args.onRetry}
      onNewDraw={args.onNewDraw}
    />
  ),
  decorators: [withPracticeResultFrame],
  parameters: { ...pageParameters('/practice/quiz', { view: 'result' }) },
  args: { onRetry: fn(), onNewDraw: fn() },
};
