import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import type {
  ContentReport,
  DiscussionPost,
  Question,
  QuestionSummary,
} from '@/lib/types';
import type {
  FetchMock,
  FetchMockRequest,
  FetchMockResponse,
} from '../support/mock-fetch';
import { fixtureImages } from './app-state';
import { fixtureSubjectQuestions, getFixtureQuestion } from './questions';

/**
 * 管理頁（/admin/...）故事用的範例資料。管理頁的 API 都要作者編輯金鑰，故事用
 * `parameters.fetchMocks` 模擬伺服器的回應，錯誤訊息照 src/pages/api/admin 的原文。
 * 模擬的伺服器跟實際 API 一樣檢查金鑰：只有 `ADMIN_STORY_KEY`（author-key）正確，其他金鑰
 * 回應伺服器的錯誤原文；存檔時回傳剛送出的內容，故事裡輸入什麼就看到什麼。
 */

/**
 * 伺服器處理時間：按下按鈕約 1 秒後才有回應，操作時看得到「驗證中…」「儲存中…」
 * 「處理中…」。
 */
const responseDelayMs = 1000;

// ---------------------------------------------------------------------------
// 金鑰驗證（/api/admin/verify-key）
// ---------------------------------------------------------------------------

const verifyKeyPath = '/api/admin/verify-key';

/** 故事用的作者編輯金鑰；輸入其他金鑰會看到金鑰錯誤。 */
export const ADMIN_STORY_KEY = 'author-key';

function authorKeyOf(request: FetchMockRequest) {
  return request.headers.get('x-author-key')?.trim() ?? '';
}

/** 驗證金鑰：author-key 正確，其他金鑰回應「作者編輯金鑰錯誤」。 */
export const verifyKey: FetchMock = {
  path: verifyKeyPath,
  method: 'POST',
  delayMs: responseDelayMs,
  respond: ({ body }) =>
    (body as { key?: unknown } | undefined)?.key === ADMIN_STORY_KEY
      ? { body: { ok: true } }
      : { status: 401, body: { error: '作者編輯金鑰錯誤' } },
};

// ---------------------------------------------------------------------------
// 題目分類管理（/admin/categories）
// ---------------------------------------------------------------------------

/** 跟伺服器的 getQuestionSummaries 一樣，每題只留題目摘要欄位。 */
function toQuestionSummary(question: Question): QuestionSummary {
  return {
    id: question.id,
    ...(question.format ? { format: question.format } : {}),
    subject: question.subject,
    year: question.year,
    questionNumber: question.questionNumber,
    primaryCategory: question.primaryCategory,
    topic: question.topic,
    tags: question.tags,
    ...(question.relatedLaws?.length ? { relatedLaws: question.relatedLaws } : {}),
    ...(question.fineTopic ? { fineTopic: question.fineTopic } : {}),
    text: question.text,
  };
}

/**
 * /admin/categories 的 props，算法跟頁面的 getStaticProps 一樣：題庫順序（科目、新年度
 * 在前、題號小到大）裡的選擇題摘要，題庫換成範例題庫。
 *
 * 法規 114 年當作剛匯入題庫：相關法規已自動分類，細分考點還沒人工填寫，所以預設的
 * 「類似題目尚未人工分類」會列出這 80 題；101、113 年都已填好。114 年第 74 題的分類是
 * 「其他」，是實際題庫中唯一「待檢核」的法規題。
 */
export const adminQuestionSummaries: QuestionSummary[] = fixtureSubjectQuestions()
  .filter((question) => question.format === 'multiple-choice')
  .map(toQuestionSummary)
  .map((question) => {
    if (question.subject !== 'law' || question.year !== 114) return question;
    const withoutFineTopic = { ...question };
    delete withoutFineTopic.fineTopic;
    return withoutFineTopic;
  });

const classificationPath = '/api/admin/classification';

/**
 * 儲存分類：金鑰不是 author-key 時回應「作者編輯金鑰不正確」；正確時回傳存好的題目。
 * 實際伺服器會依科目把分類寫成相關法規或命題分類，這裡直接寫成相關法規，畫面顯示的分類
 * 一樣是剛送出的分類。
 */
export const classificationApi: FetchMock = {
  path: classificationPath,
  method: 'PATCH',
  delayMs: responseDelayMs,
  respond: (request) => {
    if (authorKeyOf(request) !== ADMIN_STORY_KEY) {
      return { status: 401, body: { error: '作者編輯金鑰不正確' } };
    }
    const update = request.body as {
      questionId: string;
      classifications: string[];
      fineTopic?: string;
    };
    const question = getFixtureQuestion(update.questionId);
    return {
      body: {
        question: {
          ...question,
          relatedLaws: update.classifications,
          ...(update.fineTopic === undefined ? {} : { fineTopic: update.fineTopic }),
        },
      },
    };
  },
};

// ---------------------------------------------------------------------------
// 留言管理（/admin/discussions）
// ---------------------------------------------------------------------------

/**
 * 目前瀏覽器保存的留言（Storybook 不會連到 Firebase，留言都存在本機）。由新到舊，
 * 有文字留言、含回覆的提問、只有圖片的補充；留言管理頁顯示原始文字，不套用格式。
 */
export const adminDiscussionPosts: DiscussionPost[] = [
  {
    id: 'post-law-101-15-2026-10-20T08:12:00.000Z',
    questionId: 'law-101-15',
    type: 'explanation',
    content:
      '**答案 A**：建築法第 5 條所稱供公眾使用之建築物，依施行細則列舉，集合住宅要 6 層以上才算，5 層樓集合住宅不算。',
    images: [],
    createdAt: '2026-10-20T08:12:00.000Z',
    likes: 3,
    replies: [],
    reported: false,
  },
  {
    id: 'post-law-113-33-2026-10-19T13:40:00.000Z',
    questionId: 'law-113-33',
    type: 'question',
    content: '公告答案是 B、D 兩個，D「未計入建築面積之部分」為什麼也算錯？',
    images: [],
    createdAt: '2026-10-19T13:40:00.000Z',
    likes: 0,
    replies: [
      {
        id: 'reply-post-law-113-33-2026-10-19T13:40:00.000Z-2026-10-19T15:05:00.000Z',
        content:
          '檢討有效日照要包括建築物全部的投影，未計入建築面積的部分也要算，所以 D 也是錯的敘述。',
        createdAt: '2026-10-19T15:05:00.000Z',
      },
      {
        id: 'reply-post-law-113-33-2026-10-19T13:40:00.000Z-2026-10-19T16:22:00.000Z',
        content: 'B 的情況兩幢仍應合併檢討，所以 B 也錯。',
        createdAt: '2026-10-19T16:22:00.000Z',
      },
    ],
    reported: false,
  },
  {
    id: 'post-construction-113-12-2026-10-18T10:30:00.000Z',
    questionId: 'construction-113-12',
    type: 'supplement',
    content: '',
    images: fixtureImages.slice(1, 3),
    createdAt: '2026-10-18T10:30:00.000Z',
    likes: 1,
    replies: [],
    reported: false,
  },
  {
    id: 'post-env-113-05-2026-10-17T07:55:00.000Z',
    questionId: 'env-113-05',
    type: 'correction',
    content: '題幹的單位 kg/cm2 應該是 kg/cm²，上標漏掉了。',
    images: [],
    createdAt: '2026-10-17T07:55:00.000Z',
    likes: 0,
    replies: [],
    reported: true,
  },
];

/** 目前瀏覽器保存的問題回報：有指定題目的、沒指定題目的。 */
export const adminContentReports: ContentReport[] = [
  {
    id: 'report-2026-10-20T06:45:00.000Z',
    pageUrl: 'http://localhost:3000/report?question=law-101-08',
    questionId: 'law-101-08',
    category: '圖片',
    description: '題目附圖的樓梯平面圖裁切到一半，看不到右側的尺寸標註。',
    createdAt: '2026-10-20T06:45:00.000Z',
  },
  {
    id: 'report-2026-10-18T11:20:00.000Z',
    pageUrl: 'http://localhost:3000/report',
    questionId: 'structure-113-07',
    category: '答案',
    description:
      '答案顯示 D，想確認考選部有沒有更正答案，A 的剪力連桿敘述看起來也怪怪的。',
    createdAt: '2026-10-18T11:20:00.000Z',
  },
  {
    id: 'report-2026-10-16T02:10:00.000Z',
    pageUrl: 'http://localhost:3000/report',
    questionId: '',
    category: '其他',
    description: '手機橫放時，底部的題號導覽會擋住最後一個選項。',
    createdAt: '2026-10-16T02:10:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// 速記圖庫管理（/admin/memory-gallery）
// ---------------------------------------------------------------------------

/** 圖庫圖片的範例資料：圖檔用 public/memory-gallery/assets 裡的實際整理圖。 */
function galleryImage(
  id: string,
  title: string,
  description: string,
  category: MemoryGalleryImage['category'],
  createdAt: string,
  updatedAt = createdAt,
  size = { width: 1055, height: 1491 },
): MemoryGalleryImage {
  return {
    id,
    title,
    description,
    category,
    src: `/memory-gallery/assets/${id}.webp`,
    thumbnailSrc: `/memory-gallery/assets/${id}-thumb.webp`,
    ...size,
    createdAt,
    updatedAt,
  };
}

/** 「公眾建築物」：有說明的法規整理圖。 */
const editableGalleryItem = galleryImage(
  '6cf890bc-767c-4e35-bb3c-73516a802bd5',
  '公眾建築物',
  '建築技術規則',
  'law',
  '2026-10-22T01:59:14.068Z',
  '2026-10-22T02:19:59.423Z',
);

/**
 * 從網站圖庫索引（data/memory-gallery.json，2026-10-22）複製的 8 張整理圖。複製一份
 * 而不是直接讀索引，之後上傳或下架圖片時，故事的畫面與修改用的圖片才不會跟著變。
 */
const memoryGalleryManifestItems: MemoryGalleryImage[] = [
  galleryImage(
    'ddfa2116-cbc6-4a8b-9e95-ca7f027d8bdb',
    '構造高度限制整理',
    '',
    'law',
    '2026-10-20T08:39:41.333Z',
  ),
  galleryImage(
    '4ed5251b-a5bc-409e-b19e-4c61aef98b9f',
    '樓梯設置規定',
    '',
    'law',
    '2026-10-20T08:39:57.881Z',
  ),
  galleryImage(
    '84633876-2512-4792-83d3-8d6aff602421',
    '砌磚種類',
    '',
    'construction',
    '2026-10-20T08:40:08.892Z',
  ),
  galleryImage(
    '98d681fc-78a9-4e21-a180-18c389d215a5',
    '樁分類',
    '',
    'construction',
    '2026-10-20T08:40:15.305Z',
  ),
  editableGalleryItem,
  galleryImage(
    '7037d1d0-e2df-4739-be07-ee658ad432a3',
    '昇降機設置整理',
    '建築技術規則',
    'law',
    '2026-10-22T01:59:29.150Z',
    '2026-10-22T02:19:40.053Z',
  ),
  galleryImage(
    '26fe2ccb-9f84-4876-9b27-8b6626147d71',
    '採購法、都市計畫法、都市更新條例、國土計畫法、非都市使用管制規則有關期限整理',
    '',
    'law',
    '2026-10-22T02:00:08.148Z',
    '2026-10-22T02:00:08.148Z',
    { width: 1054, height: 1492 },
  ),
  galleryImage(
    'a6a60784-08d3-498d-8e8a-a5a1e909aaaa',
    '都市更新條例各種方式對應門檻',
    '都市更新條例',
    'law',
    '2026-10-22T02:00:34.160Z',
    '2026-10-22T02:19:48.364Z',
  ),
];

/**
 * /admin/memory-gallery 的 initialItems，跟 memoryGalleryStore.list() 一樣：拿掉已下架的
 * 圖片，新上傳的排前面。
 */
export const memoryGalleryAdminItems: MemoryGalleryImage[] = memoryGalleryManifestItems
  .filter((item) => !item.archivedAt)
  .sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
  );

/** 故事裡上傳、修改圖片的時間：在圖庫最後一次修改（2026-10-22 02:19）之後。 */
const galleryChangedAt = '2026-10-22T06:30:00.000Z';

const memoryGalleryPath = '/api/admin/memory-gallery';
const wrongGalleryKey = { status: 401, body: { error: '管理者編輯金鑰不正確。' } };

/** 讀出上傳圖片的實際尺寸。 */
function imageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 1055, height: 1491 });
    image.src = src;
  });
}

interface GalleryFields {
  id?: string;
  title?: string;
  description?: string;
  category?: MemoryGalleryImage['category'];
  dataUrl?: string;
}

/**
 * 圖庫的上傳、修改、下架：金鑰不是 author-key 時回應「管理者編輯金鑰不正確。」；正確時
 * 回傳剛送出的內容。上傳的圖片直接用選的檔案顯示（實際網站會轉成 WebP 存到
 * public/memory-gallery）。每個故事各自建立一份，記得這個故事裡上傳過的圖片。
 */
export function galleryApi(): FetchMock[] {
  const items = new Map(memoryGalleryAdminItems.map((item) => [item.id, item]));
  let uploads = 0;
  const guarded =
    (handle: (fields: GalleryFields) => Promise<FetchMockResponse> | FetchMockResponse) =>
    (request: FetchMockRequest) =>
      authorKeyOf(request) === ADMIN_STORY_KEY
        ? handle((request.body ?? {}) as GalleryFields)
        : wrongGalleryKey;
  return [
    {
      path: memoryGalleryPath,
      method: 'POST',
      delayMs: responseDelayMs,
      respond: guarded(async (fields) => {
        uploads += 1;
        const src = fields.dataUrl ?? '';
        const item: MemoryGalleryImage = {
          id: `3b8f2c1e-7d4a-4f6b-9c2d-${String(uploads).padStart(12, '0')}`,
          title: fields.title?.trim() ?? '',
          description: fields.description?.trim() ?? '',
          category: fields.category ?? 'law',
          src,
          thumbnailSrc: src,
          ...(await imageSize(src)),
          createdAt: galleryChangedAt,
          updatedAt: galleryChangedAt,
        };
        items.set(item.id, item);
        return { status: 201, body: { item } };
      }),
    },
    {
      path: memoryGalleryPath,
      method: 'PATCH',
      delayMs: responseDelayMs,
      respond: guarded((fields) => {
        const current = fields.id ? items.get(fields.id) : undefined;
        if (!current) return { status: 404, body: { error: '找不到這張圖片。' } };
        const item: MemoryGalleryImage = {
          ...current,
          title: fields.title?.trim() ?? current.title,
          description: fields.description?.trim() ?? current.description,
          category: fields.category ?? current.category,
          updatedAt: galleryChangedAt,
        };
        items.set(item.id, item);
        return { body: { item } };
      }),
    },
    {
      path: memoryGalleryPath,
      method: 'DELETE',
      delayMs: responseDelayMs,
      respond: guarded((fields) => {
        if (fields.id) items.delete(fields.id);
        return { body: { ok: true } };
      }),
    },
  ];
}

/** 金鑰正確，但伺服器寫入本機圖庫失敗（伺服器原文）。 */
export const galleryWriteFailed: FetchMock[] = ['POST', 'PATCH', 'DELETE'].map(
  (method) => ({
    path: memoryGalleryPath,
    method,
    delayMs: responseDelayMs,
    respond: (request) =>
      authorKeyOf(request) === ADMIN_STORY_KEY
        ? {
            status: 500,
            body: {
              error: '圖庫儲存失敗，請檢查本機索引及專案寫入權限；現有圖庫不會被清空。',
            },
          }
        : wrongGalleryKey,
  }),
);
