import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import {
  examDiscussionQuestionId,
  examsAppState,
  examsQuestionOverrides,
} from '../../fixtures/exams';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { ExamsRoute } from './exams-route';

/** 打開 /exams?question=<id> 的畫面。 */
function at(questionId: string) {
  return pageParameters('/exams', { question: questionId });
}

/**
 * 考古題討論版（/exams）：題目選擇列，接著「題目／討論區／筆記」三個分頁與右側的題號導覽。
 * 分頁記在網址的 `&tab=discussion|notes`（題目分頁沒有參數），換題時留在同一個分頁。
 *
 * 畫面上可以操作看到：
 * - 題目分頁：先作答再看解答。選項可以選、再點一次取消；「看解答」不用先選答案，按下後
 *   顯示正確答案列、答對／答錯（或只有正確答案）的判定行，與「詳解」區（內建詳解、共享的
 *   題目詳解／觀念補充／答案勘誤）；沒有詳解時顯示「目前尚無詳解」與「到討論區看看」。
 *   「重新作答」回到未作答；申論題只有「看解答」與「收起解答」。作答不會寫進作答存摺。
 *   101 年第 15 題有三則算是詳解的投稿（題目詳解、觀念補充、答案勘誤）；第 3 題有內建詳解；
 *   第 17 題一律給分；113 年第 33 題兩個答案都算對。題目面板下方是「類似考題」：同考點的
 *   其他題目（101 年第 15 題的考點只有這一題，法規 113 年第 13 題有 5 題同考點）。
 * - 討論區分頁：標籤旁是投稿數。共享內容：按讚、加入我的筆記（不會切換分頁）、檢舉、回覆、
 *   編輯、刪除；檢舉與刪除回覆都有確認視窗，刪除投稿也是。投稿表單選類型、用即時編輯器輸入
 *   字色、字級與文字格式後送出；由筆記分享過來的格式可繼續編輯並保留。
 * - 筆記分頁：跟我的筆記頁同一個編輯器（精簡的題號與題幹）。第 15 題已有筆記與圖片：
 *   編輯、儲存、刪除（有確認視窗）、分享到考古題討論版（分享後留在筆記分頁）。
 * - 換題：點題號導覽、上一題／下一題、類似考題，或切換科目、年度（換到那一份的第 1 題）。
 *   法規 101 年第 8 題題幹含圖片（點圖片放大），有只有圖片的投稿；第 11 題有兩個相關法規；
 *   第 80 題是最後一題（下一題停用）。法規 113 年第 1 題是示範題、第 13 題有 5 題類似考題。
 *   環控、結構先列申論題（結構的申論題含圖片）；構造第 2 題題目與選項最長。沒有投稿的題目
 *   討論區顯示「還沒有內容」。
 * - 難題按鈕標記／取消，題號導覽跟著標示。
 * - 手機與窄視窗（工具列的 viewport 切到「手機 390×844」或平板）：頁面收成一欄，右側的題號
 *   導覽面板隱藏；科目與年度摺在「建築法規與實務・101 年」摘要鈕後面，點開選、選完自動收起；
 *   分頁上方多一條貼在頂部列下的導覽列：第幾題／共幾題、科目・年度、上一題／下一題，「題號」
 *   鈕打開底部的題號導覽抽屜（點題號換題並關閉，Esc 或往下滑也關閉）。
 * - 側欄的「設定」（手機版在左上角選單裡）→ 閱讀設定：調整題目、選項字級。
 * - Controls 的 bank 切到「載入中」再點其他科目：科目先切過去、題目不變；切回「已下載」，
 *   題目就換到那一科。
 *
 * 工具列「雲端同步」切到未登入時，投稿表單多了「使用 Google 登入後投稿」，內容欄與送出
 * 停用；Storybook 不會連到 Firebase，共享內容一直停在載入中。
 */
const meta = {
  title: 'Layouts/考古題討論版/題目與討論',
  component: ExamsRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...pageParameters('/exams') },
  args: { bank: 'loaded', onRetryQuestionBank: fn() },
  argTypes: {
    bank: {
      options: ['loaded', 'loading', 'error', 'empty'],
      control: {
        type: 'inline-radio',
        labels: {
          loaded: '已下載',
          loading: '載入中',
          error: '載入失敗',
          empty: '沒有題目',
        },
      },
    },
    questionOverrides: { control: false },
  },
} satisfies Meta<typeof ExamsRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 101 年法規第 15 題：題目詳解（自己按過讚）、觀念補充（附圖片）、提問（有回覆）、
 * 答案勘誤（已檢舉）各一則，這一題有筆記與圖片，與同一份試卷的幾題標為難題。
 */
export const 有共享內容: Story = {
  args: { questionOverrides: examsQuestionOverrides },
  parameters: { ...at(examDiscussionQuestionId), appState: examsAppState },
};

/**
 * 打開其他科目題目的連結（環控 113 年第 1 題），那一科的題庫還沒下載好：Controls 的 bank
 * 切換「正在載入題目」與「題庫載入失敗」，失敗時的「重新載入」記在 Actions。
 */
export const 題庫載入中或失敗: Story = {
  args: { bank: 'loading' },
  argTypes: { bank: { options: ['loading', 'error'] } },
  parameters: { ...at('env-113-01') },
};

/** 連結裡的題目不在題庫中（例如已移除）。 */
export const 找不到指定題目: Story = { parameters: { ...at('law-099-01') } };

/** 完全沒有題目，連預先產生的法規題目也沒有。 */
export const 題庫尚無資料: Story = { args: { bank: 'empty' } };
