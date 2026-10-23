import { buildLawDatabaseEntries } from '@/features/laws/law-database';
import { buildResourcesOverview } from '@/features/resources/resources-overview';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import type { QuestionSummary } from '@/lib/types';
import { fixtureSubjectQuestions } from './questions';

/**
 * 統計分析（/resources）各頁的範例資料。算法照各頁的 getStaticProps，只是題庫換成
 * 範例題庫（法規 101、113、114 年；環控、構造、結構 113 年），速記圖庫用網站圖庫清單的複本
 * （data/memory-gallery.json，2026-10-22 的內容；圖片在 public/memory-gallery，
 * Storybook 直接讀得到）。用複本而不是直接讀清單，管理者上傳或下架圖片時故事畫面才不會跟著變。
 */

/**
 * 跟伺服器的 getQuestionSummaries 一樣：照伺服器題庫的順序只取選擇題，每題只留題目
 * 摘要欄位。考題分析、法規資料庫、總覽都用這份資料。
 */
export const resourceQuestionSummaries: QuestionSummary[] = fixtureSubjectQuestions()
  .filter((question) => question.format !== 'written')
  .map((question) => ({
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
  }));

/** data/memory-gallery.json 裡公開中的整理圖（複本）。 */
const memoryGalleryManifestItems: MemoryGalleryImage[] = [
  {
    id: 'ddfa2116-cbc6-4a8b-9e95-ca7f027d8bdb',
    title: '構造高度限制整理',
    description: '',
    category: 'law',
    src: '/memory-gallery/assets/ddfa2116-cbc6-4a8b-9e95-ca7f027d8bdb.webp',
    thumbnailSrc:
      '/memory-gallery/assets/ddfa2116-cbc6-4a8b-9e95-ca7f027d8bdb-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-20T08:39:41.333Z',
    updatedAt: '2026-10-20T08:39:41.333Z',
  },
  {
    id: '4ed5251b-a5bc-409e-b19e-4c61aef98b9f',
    title: '樓梯設置規定',
    description: '',
    category: 'law',
    src: '/memory-gallery/assets/4ed5251b-a5bc-409e-b19e-4c61aef98b9f.webp',
    thumbnailSrc:
      '/memory-gallery/assets/4ed5251b-a5bc-409e-b19e-4c61aef98b9f-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-20T08:39:57.881Z',
    updatedAt: '2026-10-20T08:39:57.881Z',
  },
  {
    id: '84633876-2512-4792-83d3-8d6aff602421',
    title: '砌磚種類',
    description: '',
    category: 'construction',
    src: '/memory-gallery/assets/84633876-2512-4792-83d3-8d6aff602421.webp',
    thumbnailSrc:
      '/memory-gallery/assets/84633876-2512-4792-83d3-8d6aff602421-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-20T08:40:08.892Z',
    updatedAt: '2026-10-20T08:40:08.892Z',
  },
  {
    id: '98d681fc-78a9-4e21-a180-18c389d215a5',
    title: '樁分類',
    description: '',
    category: 'construction',
    src: '/memory-gallery/assets/98d681fc-78a9-4e21-a180-18c389d215a5.webp',
    thumbnailSrc:
      '/memory-gallery/assets/98d681fc-78a9-4e21-a180-18c389d215a5-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-20T08:40:15.305Z',
    updatedAt: '2026-10-20T08:40:15.305Z',
  },
  {
    id: '6cf890bc-767c-4e35-bb3c-73516a802bd5',
    title: '公眾建築物',
    description: '建築技術規則',
    category: 'law',
    src: '/memory-gallery/assets/6cf890bc-767c-4e35-bb3c-73516a802bd5.webp',
    thumbnailSrc:
      '/memory-gallery/assets/6cf890bc-767c-4e35-bb3c-73516a802bd5-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-22T01:59:14.068Z',
    updatedAt: '2026-10-22T02:19:59.423Z',
  },
  {
    id: '7037d1d0-e2df-4739-be07-ee658ad432a3',
    title: '昇降機設置整理',
    description: '建築技術規則',
    category: 'law',
    src: '/memory-gallery/assets/7037d1d0-e2df-4739-be07-ee658ad432a3.webp',
    thumbnailSrc:
      '/memory-gallery/assets/7037d1d0-e2df-4739-be07-ee658ad432a3-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-22T01:59:29.150Z',
    updatedAt: '2026-10-22T02:19:40.053Z',
  },
  {
    id: '26fe2ccb-9f84-4876-9b27-8b6626147d71',
    title: '採購法、都市計畫法、都市更新條例、國土計畫法、非都市使用管制規則有關期限整理',
    description: '',
    category: 'law',
    src: '/memory-gallery/assets/26fe2ccb-9f84-4876-9b27-8b6626147d71.webp',
    thumbnailSrc:
      '/memory-gallery/assets/26fe2ccb-9f84-4876-9b27-8b6626147d71-thumb.webp',
    width: 1054,
    height: 1492,
    createdAt: '2026-10-22T02:00:08.148Z',
    updatedAt: '2026-10-22T02:00:08.148Z',
  },
  {
    id: 'a6a60784-08d3-498d-8e8a-a5a1e909aaaa',
    title: '都市更新條例各種方式對應門檻',
    description: '都市更新條例',
    category: 'law',
    src: '/memory-gallery/assets/a6a60784-08d3-498d-8e8a-a5a1e909aaaa.webp',
    thumbnailSrc:
      '/memory-gallery/assets/a6a60784-08d3-498d-8e8a-a5a1e909aaaa-thumb.webp',
    width: 1055,
    height: 1491,
    createdAt: '2026-10-22T02:00:34.160Z',
    updatedAt: '2026-10-22T02:19:48.364Z',
  },
];

/** 跟 memoryGalleryStore.list() 一樣：拿掉已下架的圖片，新上傳的排前面。 */
export const memoryGalleryItems: MemoryGalleryImage[] = memoryGalleryManifestItems
  .filter((item) => !item.archivedAt)
  .sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id),
  );

function memoryGalleryItem(id: string): MemoryGalleryImage {
  const item = memoryGalleryItems.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`速記圖庫沒有 ${id}`);
  return item;
}

/** 「樓梯設置規定」：一般長度標題、沒有說明的法規整理圖。 */
export const stairsGalleryItem = memoryGalleryItem(
  '4ed5251b-a5bc-409e-b19e-4c61aef98b9f',
);
/** 標題很長的整理圖，用來看放大檢視標題被截斷的樣子。 */
export const longTitleGalleryItem = memoryGalleryItem(
  '26fe2ccb-9f84-4876-9b27-8b6626147d71',
);

/**
 * 圖檔讀不出來的整理圖（圖檔損毀），放大檢視會顯示載入失敗。用內容無效的 data URL，
 * 不會像找不到檔案（404）那樣在 console 留下錯誤。
 */
export const brokenFileGalleryItem: MemoryGalleryImage = {
  ...stairsGalleryItem,
  id: '00000000-0000-4000-8000-000000000000',
  title: '圖檔損毀的整理圖',
  src: 'data:image/webp;base64,AAAA',
  thumbnailSrc: 'data:image/webp;base64,AAAA',
};

/**
 * 法規題還沒標註「人工細分考點」（fineTopic）時的題目摘要。詳細趨勢分析切到
 * 「人工細分考點」會沒有資料。
 */
export const summariesWithoutFineTopic: QuestionSummary[] = resourceQuestionSummaries.map(
  (question) => ({ ...question, fineTopic: undefined }),
);

/** 統計分析總覽的統計，算法跟 src/pages/resources/index.tsx 的 getStaticProps 一樣。 */
export const resourcesOverview = buildResourcesOverview(
  resourceQuestionSummaries,
  memoryGalleryItems,
);

/** 題庫、整理圖、法規都還沒有資料時的總覽。 */
export const emptyResourcesOverview = buildResourcesOverview([], []);

/** 題庫只有一個年度（113 年）時，年度範圍只顯示一個年份。 */
export const singleYearResourcesOverview = buildResourcesOverview(
  resourceQuestionSummaries.filter((question) => question.year === 113),
  memoryGalleryItems,
);

/** 法規資料庫的清單，算法跟 src/pages/resources/laws.tsx 的 getStaticProps 一樣。 */
export const lawDatabaseEntries = buildLawDatabaseEntries(resourceQuestionSummaries);
