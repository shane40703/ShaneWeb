import { createDefaultState } from '@/lib/study';
import type { AppState, ImageAttachment } from '@/lib/types';

/** 故事裡固定使用的時間，畫面上的日期才不會每次打開都不一樣。 */
export const FIXTURE_NOW = '2026-10-20T09:30:00.000Z';

/** 預設的本機作答資料，再蓋上故事需要的欄位。 */
export function createStoryState(overrides: Partial<AppState> = {}): AppState {
  return { ...createDefaultState(), ...overrides };
}

function svgDataUrl(label: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="${color}"/><path d="M40 260 L160 120 L250 210 L320 150 L440 260 Z" fill="#ffffff" fill-opacity="0.55"/><circle cx="380" cy="80" r="34" fill="#ffffff" fill-opacity="0.7"/><text x="40" y="60" font-family="sans-serif" font-size="28" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 筆記與投稿用的範例圖片（內嵌 SVG，不需要網路）。 */
export const fixtureImages: ImageAttachment[] = [
  {
    id: 'story-image-1',
    name: '法條截圖.png',
    type: 'image/svg+xml',
    dataUrl: svgDataUrl('法條截圖', '#2563eb'),
  },
  {
    id: 'story-image-2',
    name: '計算過程.png',
    type: 'image/svg+xml',
    dataUrl: svgDataUrl('計算過程', '#0d9488'),
  },
  {
    id: 'story-image-3',
    name: '構造詳圖.png',
    type: 'image/svg+xml',
    dataUrl: svgDataUrl('構造詳圖', '#d97706'),
  },
  {
    id: 'story-image-4',
    name: '易錯觀念.png',
    type: 'image/svg+xml',
    dataUrl: svgDataUrl('易錯觀念', '#7c3aed'),
  },
];

/** 一段用到所有文字格式的筆記內容。 */
export const fixtureNoteContent =
  '**建築法第 5 條**：供公眾使用之建築物。\n集合住宅要 _6 層以上_ 才算，!!5 層樓不算!!。\n面積單位 m^2^、化學式 H~2~O。';
