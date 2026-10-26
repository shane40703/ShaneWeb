import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  PracticeQuiz,
  type PracticeQuestionStatus,
} from '@/features/practice/practice-quiz';
import {
  createPracticeTimer,
  movePracticeTo,
  PRACTICE_PATH,
  type PracticeSession,
} from '@/features/practice/practice-session';
import PracticeQuizRoute from '@/pages/practice/quiz';
import { fixtureImages, fixtureNoteContent } from '../../fixtures/app-state';
import {
  answerFirst,
  answerPractice,
  drawPracticeSession,
  practiceDiscussionPosts,
} from '../../fixtures/practice';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import {
  practicePageParameters,
  stayInStoryOnRewind,
  withPracticeQuestionFrame,
} from './practice-frame';

/**
 * 選項之間有淺線；未確認前可再點已選選項取消，確認後仍鎖定答案。
 * 截圖的五題題組：第 1 題是截圖那題（建築法第 5 條），第 2 題題幹有圖，第 3 題題目很長、
 * 有兩個正確答案，第 4 題一律給分，第 5 題是最後一題。
 */
const blankSession: PracticeSession = {
  version: 1,
  id: 'story-practice-session',
  subject: 'law',
  rangeStart: 100,
  rangeEnd: 114,
  category: 'all',
  questionIds: ['law-101-15', 'law-101-08', 'law-113-33', 'law-101-17', 'law-101-40'],
  // 截圖的選項順序：A 5 層樓集合住宅、B 工廠、C 私人辦公大樓、D 市場。
  optionOrders: { 'law-101-15': [0, 3, 1, 2] },
  answers: {},
  drafts: {},
  eliminated: {},
  elapsedSeconds: {},
  currentIndex: 0,
};

// 截圖：第 1 題選 D 市場、作答 1 秒，照網站的判分規則確認答案（答錯）。
const screenshotSession = answerPractice(
  blankSession,
  { 'law-101-15': 3 },
  { 'law-101-15': 1 },
);

// 網站預設抽 50 題：已作答 23 題（對、對、錯循環），停在第 24 題。
const fiftyQuestions = {
  ...answerFirst(drawPracticeSession({ id: 'story-practice-fifty' }), 23),
  currentIndex: 23,
};

/** 網址 ?q= 指的題目；不是題組裡的題號時回傳 null。 */
function questionIndexOf(q: string | string[] | undefined, total: number) {
  const index = Number(Array.isArray(q) ? q[0] : q) - 1;
  return Number.isInteger(index) && index >= 0 && index < total ? index : null;
}

/**
 * 題目顯示不出來時的作答畫面。整頁故事的題庫一定載入得到，所以這裡直接用 PracticeQuiz 的
 * status 畫出來；跟網站一樣，點題號導覽或「下一題」會改網址的 ?q= 換題。
 */
function UnavailableQuestion({
  status,
  onRetry,
  onSubmit,
  onAbandon,
}: {
  status: Exclude<PracticeQuestionStatus, 'ready'>;
  onRetry: () => void;
  onSubmit: () => void;
  onAbandon: () => void;
}) {
  const router = useRouter();
  const [timer] = useState(createPracticeTimer);
  const total = screenshotSession.questionIds.length;
  const index = questionIndexOf(router.query.q, total) ?? 0;

  return (
    <PracticeQuiz
      session={movePracticeTo(screenshotSession, index)}
      question={undefined}
      status={status}
      timer={timer}
      onRetry={onRetry}
      onSelect={() => undefined}
      onToggleEliminated={() => undefined}
      onConfirm={() => undefined}
      onGoTo={(next) =>
        void router.push({ pathname: PRACTICE_PATH, query: { q: next + 1 } })
      }
      onSubmit={onSubmit}
      onAbandon={onAbandon}
    />
  );
}

/**
 * 每日抽題練習的作答畫面：整個 /practice/quiz 頁面，練習進度從瀏覽器的存檔讀出，網址的
 * `?q=` 決定顯示第幾題，跟網站一樣操作。
 * 作答區使用整個頁面寬度，桌機題號欄維持右側，手機改成上下排列。
 * 底部操作列在桌機與手機預覽都會貼住視窗底部；長題目、詳解與筆記仍隨整頁捲動，不必捲到底才能換題。
 *
 * 畫面上可以操作看到：
 * - 選選項、按選項右邊的刪去鈕劃掉選項、「確認答案」後的答對／答錯、詳解與使用者筆記
 * - 確認已打亂選項的題目後，各選項內容末尾顯示淡色「原選項 A／B／C／D」，可對照未改寫的詳解；未確認前不顯示
 * - 「下一題」「跳過」「上一題」與題號導覽換題；最後一題先只顯示「確認答案」，確認後才換成「完成練習」。
 * - 右側不顯示交卷或下方標記說明；最後一題的「完成練習」進入結果（其他題尚未作答會先詢問）；結果的「重做這組題目」
 *   回到第 1 題，「重新選科／抽題」回到設定畫面
 * - 「重新選科／設定」放棄題組回到設定畫面（有作答進度時瀏覽器會先詢問）
 * - 標記為難題、在使用者筆記輸入文字或貼上圖片
 */
const meta = {
  title: 'Layouts/每日抽題練習/作答畫面',
  component: PracticeQuizRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...pageParameters('/practice/quiz') },
  beforeEach: stayInStoryOnRewind,
} satisfies Meta<typeof PracticeQuizRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 從使用者截圖的畫面開始：第 1 題答錯（選 D 市場）、作答時間 00:00:01、還沒有詳解與筆記。
 * 按「下一題」是還沒作答、題幹有圖的第 2 題；第 3 題題目很長、有兩個正確答案；第 4 題
 * 一律給分（選什麼都算答對）；第 5 題是最後一題，先「確認答案」再按「完成練習」查看結果。
 */
export const 五題題組: Story = {
  parameters: { ...practicePageParameters(screenshotSession) },
};

/** 截圖那題標成難題，有使用者筆記、筆記圖片，以及其他使用者分享的詳解與補充（含圖片）。 */
export const 有筆記與社群詳解: Story = {
  parameters: {
    ...practicePageParameters(screenshotSession),
    appState: {
      difficultQuestionIds: ['law-101-15'],
      notes: { 'law-101-15': fixtureNoteContent },
      noteImages: { 'law-101-15': fixtureImages.slice(0, 2) },
      discussionPosts: practiceDiscussionPosts('law-101-15'),
    },
  },
};

/**
 * 網站預設抽出的五十題：已作答 23 題，停在還沒作答的第 24 題，幾題標成難題。
 * 題號導覽在自己的捲動區裡，換題時會捲到目前的題號。
 */
export const 五十題題組: Story = {
  parameters: {
    ...practicePageParameters(fiftyQuestions),
    appState: {
      difficultQuestionIds: [2, 9, 23, 31].map(
        (index) => fiftyQuestions.questionIds[index],
      ),
    },
  },
};

/** 從難題標記開啟的完整題組，跨所有年度；作答、筆記、完成後重做都沿用同一個練習頁。 */
export const 本科目難題整組: Story = {
  parameters: {
    ...practicePageParameters({ ...blankSession, reviewSource: 'difficult' }),
    appState: { difficultQuestionIds: blankSession.questionIds },
  },
};

/**
 * 題目顯示不出來：Controls 的 status 切換「載入中」「載入失敗」「找不到題目」（題庫裡沒有
 * 這一題）。點題號導覽的 5 可以看到最後一題找不到題目時沒有「下一題」。
 */
export const 題目無法顯示: StoryObj<typeof UnavailableQuestion> = {
  render: (args) => <UnavailableQuestion {...args} />,
  decorators: [withPracticeQuestionFrame],
  parameters: { ...pageParameters('/practice/quiz', { q: '1' }) },
  args: { status: 'loading', onRetry: fn(), onSubmit: fn(), onAbandon: fn() },
  argTypes: {
    status: {
      options: ['loading', 'error', 'missing'],
      control: {
        type: 'select',
        labels: { loading: '載入中', error: '載入失敗', missing: '找不到題目' },
      },
    },
  },
};
