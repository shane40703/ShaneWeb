export const MEMORY_GALLERY_CATEGORIES = [
  { id: 'law', label: '法規' },
  { id: 'construction', label: '構造' },
  { id: 'env', label: '環控' },
  { id: 'structure', label: '結構' },
] as const;
export type MemoryGalleryCategory = typeof MEMORY_GALLERY_CATEGORIES[number]['id'];
export const MEMORY_GALLERY_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MEMORY_GALLERY_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export interface MemoryGalleryImage {
  id: string;
  title: string;
  description: string;
  category: MemoryGalleryCategory;
  src: string;
  thumbnailSrc: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export function isMemoryGalleryCategory(value: unknown): value is MemoryGalleryCategory {
  return MEMORY_GALLERY_CATEGORIES.some(category => category.id === value);
}

export function memoryGalleryCategoryLabel(category: MemoryGalleryCategory) {
  return MEMORY_GALLERY_CATEGORIES.find(item => item.id === category)!.label;
}

export function readMemoryGalleryMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('圖庫資料格式不正確。');
  const input = value as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!title || title.length > 100) throw new Error('請填寫 1–100 字的圖片標題。');
  if (description.length > 1000) throw new Error('圖片說明最多 1,000 字。');
  if (!isMemoryGalleryCategory(input.category)) throw new Error('請選擇法規、構造、環控或結構。');
  return { title, description, category: input.category };
}

export function filterMemoryGalleryImages(items: MemoryGalleryImage[], category: MemoryGalleryCategory, search: string) {
  const query = search.trim().toLocaleLowerCase('zh-TW');
  return items.filter(item => !item.archivedAt && item.category === category &&
    (!query || `${item.title}\n${item.description}`.toLocaleLowerCase('zh-TW').includes(query)));
}
