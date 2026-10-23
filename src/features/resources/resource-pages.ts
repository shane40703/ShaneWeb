import { IconChartPie, IconPhoto, IconScale, IconStack2 } from '@tabler/icons-react';
import {
  MEMORY_GALLERY_CATEGORIES,
  type MemoryGalleryCategory,
} from '@/lib/memory-gallery';

/**
 * Single source for the resources hub (新版) and the pages it gathers, shared by the
 * sidebar, hub cards, section switcher and topbar titles so their wording never drifts.
 */
export const resourcesHub = {
  href: '/resources',
  label: '統計分析',
  shortLabel: '總覽',
  icon: IconStack2,
} as const;

export const resourcePages = [
  {
    id: 'analysis',
    href: '/resources/analysis',
    label: '考題分析',
    icon: IconChartPie,
    summary: '哪些主題最常考、歷年怎麼變',
    detail: '選科目與年度，查看命題分布、歷年趨勢與對應考古題。',
  },
  {
    id: 'memory-gallery',
    href: '/resources/memory-gallery',
    label: '速記圖庫',
    icon: IconPhoto,
    summary: '考前快速翻的整理圖',
    detail: '依科目瀏覽，點圖片可自由縮放、拖曳閱讀；僅供線上檢視。',
  },
  {
    id: 'laws',
    href: '/resources/laws',
    label: '法規資料庫',
    icon: IconScale,
    summary: '考過的法規，直接查原文',
    detail: '點法規會在新分頁開啟法務部全國法規資料庫的搜尋結果。',
  },
] as const;

export type ResourcePage = (typeof resourcePages)[number];
export type ResourcePageId = ResourcePage['id'];

const [defaultGalleryCategory] = MEMORY_GALLERY_CATEGORIES;

/**
 * Each gallery subject is its own prerendered page, so a shared or reloaded link shows the
 * right images straight away; the first subject lives at the plain gallery URL.
 */
export function resourceGalleryHref(category: MemoryGalleryCategory) {
  const galleryHref = '/resources/memory-gallery';
  return category === defaultGalleryCategory.id
    ? galleryHref
    : `${galleryHref}/${category}`;
}
