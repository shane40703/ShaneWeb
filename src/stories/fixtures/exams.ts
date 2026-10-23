import type { AppState, DiscussionPost, Question } from '@/lib/types';
import { fixtureImages } from './app-state';
import { getFixtureQuestion, withExplanation } from './questions';

/**
 * 歷屆試題（/exams）故事用的範例資料。沒有設定雲端時，網站把共享投稿存在本機
 * （`appState.discussionPosts`），所以這些投稿都算「自己的投稿」，會出現編輯、刪除按鈕；
 * 按讚紀錄在 `likedDiscussionPostIds`。工具列「雲端同步」切到雲端狀態時，網站改讀雲端的
 * 投稿（Storybook 不會連到 Firebase，會一直顯示載入中），這些本機投稿就不會出現。
 */

/** 打開時的題目：101 年法規第 15 題（建築法第 5 條）。 */
export const examDiscussionQuestionId = 'law-101-15';

/** 第 15 題的四種投稿各一則，由新到舊排列（跟網站新增投稿時的順序一樣）。 */
const discussionPosts: DiscussionPost[] = [
  {
    id: 'story-post-explanation',
    questionId: examDiscussionQuestionId,
    type: 'explanation',
    content:
      '**答案 A**：建築法第 5 條所稱供公眾使用之建築物，依同法施行細則列舉，集合住宅要 _6 層以上_ 才算，!!5 層樓集合住宅不算!!。\n\n工廠、市場、私人辦公大樓（總樓地板面積 1000 m^2^ 以上）都在列舉範圍內。\n法條：https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070109&flno=5',
    images: [],
    createdAt: '2026-10-19T14:05:00.000Z',
    likes: 5,
    replies: [],
    reported: false,
  },
  {
    id: 'story-post-supplement',
    questionId: examDiscussionQuestionId,
    type: 'supplement',
    content:
      '整理「供公眾使用之建築物」常考的樓層與面積門檻，附上法條截圖和自己整理的易錯觀念。',
    images: [fixtureImages[0], fixtureImages[3]],
    createdAt: '2026-10-18T09:12:00.000Z',
    likes: 2,
    replies: [],
    reported: false,
  },
  {
    id: 'story-post-question',
    questionId: examDiscussionQuestionId,
    type: 'question',
    content:
      '如果是 6 層樓的集合住宅，但總樓地板面積只有 800 平方公尺，還算供公眾使用嗎？',
    images: [],
    createdAt: '2026-10-17T10:25:00.000Z',
    likes: 0,
    replies: [
      {
        id: 'story-reply-1',
        content:
          '施行細則看的是 **6 層以上** 的集合住宅，面積門檻是給其他用途用的，所以仍然算。',
        createdAt: '2026-10-17T12:40:00.000Z',
      },
      {
        id: 'story-reply-2',
        content: '補充：考題常把面積和樓層混在一起，記得分開看。',
        createdAt: '2026-10-17T15:02:00.000Z',
      },
    ],
    reported: false,
  },
  {
    id: 'story-post-correction',
    questionId: examDiscussionQuestionId,
    type: 'correction',
    content: '答案應該是 D 工廠才對？工廠不是供公眾使用。',
    images: [],
    createdAt: '2026-10-16T08:00:00.000Z',
    likes: 0,
    replies: [],
    reported: true,
  },
];

/**
 * 從筆記分享的題目詳解（101 年法規第 8 題，樓梯寬度）：筆記只有圖片、沒有文字時，
 * 投稿只顯示圖片，沒有內文段落。
 */
const imageOnlyPost: DiscussionPost = {
  id: 'story-post-image-only',
  questionId: 'law-101-08',
  type: 'explanation',
  content: '',
  images: [...fixtureImages],
  createdAt: '2026-10-20T08:40:00.000Z',
  likes: 3,
  replies: [],
  reported: false,
};

/** 同一份試卷其他題目的投稿，題號導覽會在這些題號標出「有詳解或討論」。 */
const paperDiscussionPosts: DiscussionPost[] = [
  {
    id: 'story-post-law-101-08',
    questionId: 'law-101-08',
    type: 'explanation',
    content: '樓梯寬度量到扶手內緣，扶手凸出 10 公分以內可以不計，所以是 W。',
    images: [],
    createdAt: '2026-10-15T11:30:00.000Z',
    likes: 1,
    replies: [],
    reported: false,
  },
  {
    id: 'story-post-law-101-40',
    questionId: 'law-101-40',
    type: 'question',
    content: '細部計畫書的「事業及財務計畫」跟主要計畫的差在哪裡？',
    images: [],
    createdAt: '2026-10-14T07:45:00.000Z',
    likes: 0,
    replies: [],
    reported: false,
  },
];

/**
 * 本機作答資料：第 15 題四種投稿各一則（題目詳解自己按過讚），第 8 題有只有圖片的投稿
 * 與文字詳解，第 40 題有提問；第 15、8、27、40 題標為難題。
 */
export const examsAppState: Partial<AppState> = {
  discussionPosts: [imageOnlyPost, ...discussionPosts, ...paperDiscussionPosts],
  likedDiscussionPostIds: ['story-post-explanation'],
  difficultQuestionIds: ['law-101-15', 'law-101-08', 'law-101-27', 'law-101-40'],
};

/**
 * 取代範例題庫中的題目：101 年法規第 3 題加上內建詳解（題號導覽一樣標出「有詳解或
 * 討論」），113 年法規第 1 題改成示範題（資料來源不是考選部官方試卷時標「示範題」）。
 */
export const examsQuestionOverrides: readonly Question[] = [
  withExplanation(
    getFixtureQuestion('law-101-03'),
    '排煙設備的排煙口要設在天花板或天花板下 80 公分以內的牆面。',
  ),
  { ...getFixtureQuestion('law-113-01'), source: { kind: 'sample' } },
];
