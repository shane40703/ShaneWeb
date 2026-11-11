import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import {
  examDiscussionQuestionId,
  examsAppState,
  examsQuestionOverrides,
} from '../../fixtures/exams';
import { withStatefulRouter } from '../../support/stateful-router';
import { pageParameters, withPageFrame } from '../../support/story-environment';
import { examsSlug } from '@/lib/question-path';
import { ExamsRoute } from './exams-route';

/** 打開這一題的畫面；網站的網址是 /exams/law/114/3，故事用 slug 參數代替路徑。 */
function at(questionId: string) {
  return pageParameters('/exams', { slug: examsSlug(questionId) });
}

/** 打開總覽頁：[] 是歷屆試題（討論版）本身、['law'] 是一科、['law', '114'] 是一份試卷。 */
function atPlace(slug: string[]) {
  return pageParameters('/exams', { slug });
}

/**
 * 歷屆試題（討論版）的題目頁（/exams/law/114/3）：最上面是科目、年度選擇區，接著「題目／討論區／
 * 筆記」三個分頁與右側的題號導覽，沒有「返回」。
 * 分頁記在網址的 `&tab=discussion|notes`（題目分頁沒有參數），換題時留在同一個分頁。
 * 只有指名某一題的網址才顯示題目；歷屆試題（討論版）本身、各科、各年度是總覽頁（見下方「總覽」
 * 「科目」「試卷」等故事），最上方是同一塊選擇區，位置和大小都一樣，下面列出內容，不放任何
 * 題目的內容。
 *
 * 畫面上可以操作看到：
 * - 題目分頁：先作答再看解答。選項可以選、再點一次取消；「看解答」不用先選答案，按下後
 *   顯示正確答案列、答對／答錯（或只有正確答案）的判定行，與「詳解」區（內建詳解、共享的
 *   題目詳解／觀念補充／答案勘誤）；沒有詳解時顯示「目前尚無詳解」與「到討論區看看」。
 *   「重新作答」回到未作答；申論題只有「看解答」與「收起解答」。題目下方右側可複製題目與選項。
 *   作答不會寫進作答存摺。
 *   101 年第 15 題有三則算是詳解的投稿（題目詳解、觀念補充、答案勘誤）；第 3 題有內建詳解；
 *   第 17 題一律給分；113 年第 33 題兩個答案都算對。題目面板下方是「類似考題」：同考點的
 *   其他題目（101 年第 15 題的考點只有這一題，法規 113 年第 13 題有 5 題同考點）。
 * - 討論區分頁：標籤旁是投稿數。共享內容：按讚、加入我的筆記（不會切換分頁）、檢舉、回覆、
 *   編輯、刪除；檢舉與刪除回覆都有確認視窗，刪除投稿也是。投稿表單選類型、用即時編輯器輸入
 *   字色、字級與文字格式後送出；由筆記分享過來的格式可繼續編輯並保留。
 * - 筆記分頁：跟我的筆記頁同一個編輯器（精簡的題號與題幹）。第 15 題已有筆記與圖片：
 *   編輯、儲存、刪除（有確認視窗）、分享到討論版（分享後留在筆記分頁）。
 * - 換題：點題號導覽、上一題／下一題、類似考題。點科目打開那一科最新一年的第 1 題，點年度
 *   打開這一科那一年的第 1 題（有申論題的試卷從申論第 1 題開始），開著的分頁不變；按的就是
 *   畫面上這一題時只收起選擇區。換試卷多一筆瀏覽紀錄並回到頁首，上一頁回到剛才那一題；換題
 *   不會。科目、年度按鈕用新分頁打開是科目頁、試卷頁。作答、筆記草稿與還沒送出的投稿在來回
 *   之間都會保留。
 *   法規 101 年第 8 題題幹含圖片（點圖片放大），有只有圖片的投稿；第 11 題有兩個相關法規；
 *   第 80 題是最後一題（下一題停用）。法規 113 年第 1 題是示範題、第 13 題有 5 題類似考題。
 *   環控、結構先列申論題（結構的申論題含圖片）；構造第 2 題題目與選項最長。沒有投稿的題目
 *   討論區顯示「還沒有內容」。
 * - 難題按鈕標記／取消，題號導覽跟著標示。
 * - 手機與窄視窗（工具列的 viewport 切到「手機 390×844」或平板）：頁面收成一欄，右側的題號
 *   導覽面板隱藏；科目與年度摺在「營建法規與實務・101 年」摘要鈕後面（總覽和科目頁一開始就
 *   展開），點開選、選完自動收起；開著按上一題、下一題或題號，仍然開著；
 *   分頁上方多一條貼在頂部列下的導覽列：第幾題／共幾題、科目・年度、上一題／下一題，「題號」
 *   鈕打開底部的題號導覽抽屜（點題號換題並關閉，Esc 或往下滑也關閉）。
 * - 側欄的「設定」（手機版在左上角選單裡）→ 閱讀設定：調整題目、選項字級。
 * - 側欄的「歷屆試題（討論版）」在網頁原始碼裡連到 /exams；在別頁直接點，會回到上次在歷屆試題（討論版）
 *   看的那一頁與分頁（第一次是 114 年營建法規與實務第 1 題）。已經在這裡，再點只會關掉手機選單。
 * - Controls 的 bank 切到「載入中」再點其他科目：網址換到那一科最新一年的第 1 題，題目卡片
 *   維持原本的大小，上面顯示「正在載入題目內容…」；切回「已下載」，題目就出現。
 *
 * 工具列「雲端同步」切到未登入時，投稿表單多了「使用 Google 登入後投稿」，內容欄與送出
 * 停用；Storybook 不會連到 Firebase，共享內容一直停在載入中。
 */
const meta = {
  title: 'Layouts/歷屆試題（討論版）/題目與討論',
  component: ExamsRoute,
  decorators: [withStatefulRouter, withPageFrame],
  parameters: { ...at('law-114-01') },
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
 * 打開其他科目題目的連結（環控 113 年第 1 題），那一科的題庫還沒下載好：選擇區、分頁與題號
 * 導覽照常，題目的位置是一塊等待的卡片。Controls 的 bank 切換「正在載入題目內容…」與「題目
 * 暫時無法顯示」，失敗時的「重新載入」記在 Actions。
 */
export const 題庫載入中或失敗: Story = {
  args: { bank: 'loading' },
  argTypes: { bank: { options: ['loading', 'error'] } },
  parameters: { ...at('env-113-01') },
};

/** 連結裡的題目不在題庫中（例如已移除）。 */
export const 找不到指定題目: Story = { parameters: { ...at('law-099-01') } };

/** 完全沒有題目，連預先產生的法規題目也沒有。 */
export const 題庫尚無資料: Story = {
  args: { bank: 'empty' },
  parameters: { ...at('law-114-01') },
};

/**
 * 歷屆試題（討論版）本身（/exams）：最上方是題目頁那一塊科目、年度選擇區，還沒選科目，年度按鈕都
 * 不能按（手機一開始就展開）。下面一段說明，與一塊面板一列一科（圖示、科目名稱、說明、年份
 * 範圍與題數），只列事實、不能點。點上方的科目打開那一科最新一年的第 1 題。頂部列標題是
 * 「歷屆試題（討論版）」。
 */
export const 總覽: Story = { parameters: { ...atPlace([]) } };

/**
 * 一科（/exams/law）：選擇區選著這一科、還沒選年度（手機一開始就展開），下面是這一科的說明與
 * 十五份試卷（新到舊，各自的題數），只列事實、不能點。點上方的年度打開那一年的第 1 題。
 * 範例題庫只有法規 101、113、114 年；頂部列標題是「營建法規與實務考古題」。
 */
export const 科目: Story = { parameters: { ...atPlace(['law']) } };

/**
 * 一份試卷（/exams/law/114）：選擇區選著這一科與這一年（手機收在摘要鈕後面），下面是考得最多
 * 的三個考點，與每一題一列「第幾題＋考點」（題目頁上橘色標籤的同一組字）。寬頁面選擇題排兩欄，
 * 1 到 40 在左、41 到 80 在右；窄頁面一欄。點一題打開那一題，上一頁回到這一頁的同一列。
 */
export const 試卷: Story = { parameters: { ...atPlace(['law', '114']) } };

/**
 * 有申論題的試卷（範例題庫沒有環控 114 年，用 113 年）：申論題排在選擇題前面，各有一個小標
 * 與題數，中間是虛線。
 */
export const 試卷有申論題: Story = { parameters: { ...atPlace(['env', '113']) } };

/**
 * 從別頁換到一份還沒下載的試卷：題號已經可以點，考點還沒來，說明下方是「正在載入考點…」。
 */
export const 試卷考點載入中: Story = {
  args: { bank: 'loading' },
  argTypes: { bank: { options: ['loading'] } },
  parameters: { ...atPlace(['env', '113']) },
};

/** 試卷下載失敗：「考點暫時無法載入。」與「重新載入」（記在 Actions），題號照樣可以點。 */
export const 試卷考點載入失敗: Story = {
  args: { bank: 'error' },
  argTypes: { bank: { options: ['error'] } },
  parameters: { ...atPlace(['env', '113']) },
};

/**
 * 在總覽點一個還沒下載的科目（環控；範例題庫最新的是 113 年，從申論第 1 題開始）：選擇區留在
 * 原處，題號導覽與分頁都已經在，題目的位置是一塊等待的卡片（網站上題目到了就換成題目）。Controls 的
 * bank 切到「載入失敗」是「題目暫時無法顯示」與「重新載入」。
 */
export const 從總覽換科目: Story = {
  name: '從總覽換科目（題目下載中）',
  args: { bank: 'loading' },
  argTypes: { bank: { options: ['loading', 'error'] } },
  parameters: { ...at('env-113-written-01') },
};
