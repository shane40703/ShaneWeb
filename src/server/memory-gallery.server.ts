import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  MEMORY_GALLERY_MAX_FILE_BYTES, readMemoryGalleryMetadata, type MemoryGalleryImage,
} from '@/lib/memory-gallery';

export class MemoryGalleryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function canEditMemoryGallery() {
  return process.env.NODE_ENV === 'development' && !process.env.VERCEL;
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
}

function validateStoredImage(value: unknown): MemoryGalleryImage {
  if (!value || typeof value !== 'object') throw new Error('速記圖庫索引格式錯誤，請先還原索引再編輯。');
  const item = value as MemoryGalleryImage;
  readMemoryGalleryMetadata(item);
  if (!validId(item.id) || item.src !== `/memory-gallery/assets/${item.id}.webp` ||
    item.thumbnailSrc !== `/memory-gallery/assets/${item.id}-thumb.webp` ||
    !Number.isInteger(item.width) || item.width < 1 || !Number.isInteger(item.height) || item.height < 1 ||
    !Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.updatedAt)) ||
    (item.archivedAt !== undefined && !Number.isFinite(Date.parse(item.archivedAt)))) {
    throw new Error('速記圖庫索引格式錯誤，請先還原索引再編輯。');
  }
  return item;
}

export function createMemoryGalleryStore(root = process.cwd()) {
  const manifestPath = path.join(root, 'data', 'memory-gallery.json');
  const assetsPath = path.join(root, 'public', 'memory-gallery', 'assets');
  let pendingWrite: Promise<unknown> = Promise.resolve();

  async function read(): Promise<MemoryGalleryImage[]> {
    let raw: string;
    try { raw = await readFile(manifestPath, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.items)) throw new Error('速記圖庫索引格式錯誤，請先還原索引再編輯。');
    const items = data.items.map(validateStoredImage) as MemoryGalleryImage[];
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('速記圖庫索引含重複圖片，請先還原索引再編輯。');
    return items;
  }

  async function save(items: MemoryGalleryImage[]) {
    await mkdir(path.dirname(manifestPath), { recursive: true });
    const temporaryPath = path.join(path.dirname(manifestPath), `.memory-gallery.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify({ version: 1, items }, null, 2)}\n`, { flag: 'wx' });
      await rename(temporaryPath, manifestPath);
    } finally { await unlink(temporaryPath).catch(() => {}); }
  }

  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const next = pendingWrite.then(operation);
    pendingWrite = next.catch(() => {});
    return next;
  }

  return {
    async list() {
      await pendingWrite;
      return (await read()).filter(item => !item.archivedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    },
    upload(value: unknown) {
      return mutate(async () => {
        const metadata = readMemoryGalleryMetadata(value);
        const dataUrl = (value as Record<string, unknown>).dataUrl;
        if (typeof dataUrl !== 'string' || dataUrl.length > Math.ceil(MEMORY_GALLERY_MAX_FILE_BYTES / 3) * 4 + 64) {
          throw new MemoryGalleryError('單張圖片不可超過 8 MB。', 413);
        }
        const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
        if (!match) throw new MemoryGalleryError('僅接受 PNG、JPEG 或 WebP 圖片。');
        const bytes = Buffer.from(match[2], 'base64');
        if (!bytes.length || bytes.length > MEMORY_GALLERY_MAX_FILE_BYTES || bytes.toString('base64') !== match[2]) {
          throw new MemoryGalleryError('圖片資料無效或超過 8 MB。');
        }
        const rasterSignature = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
          (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
        if (!rasterSignature) throw new MemoryGalleryError('圖片內容不是有效的 PNG、JPEG 或 WebP。');
        const sharp = (await import('sharp')).default;
        let full;
        try {
          const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning' });
          const info = await image.metadata();
          if (!['png', 'jpeg', 'webp'].includes(info.format ?? '') || (info.pages ?? 1) > 1) throw new Error('unsupported image');
          full = await image.rotate().resize({ width: 12000, height: 12000, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 92 }).toBuffer({ resolveWithObject: true });
        } catch { throw new MemoryGalleryError('無法讀取這張圖片，請使用有效的靜態 PNG、JPEG 或 WebP，且不超過 2,400 萬像素。'); }
        const thumbnail = await sharp(full.data).resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        // Verify the index before creating any assets; never overwrite a corrupt index.
        const items = await read();
        const id = randomUUID();
        const now = new Date().toISOString();
        const item: MemoryGalleryImage = { id, ...metadata, src: `/memory-gallery/assets/${id}.webp`,
          thumbnailSrc: `/memory-gallery/assets/${id}-thumb.webp`, width: full.info.width, height: full.info.height,
          createdAt: now, updatedAt: now };
        await mkdir(assetsPath, { recursive: true });
        await writeFile(path.join(assetsPath, `${id}.webp`), full.data, { flag: 'wx' });
        await writeFile(path.join(assetsPath, `${id}-thumb.webp`), thumbnail, { flag: 'wx' });
        await save([...items, item]);
        return item;
      });
    },
    update(id: unknown, value: unknown) {
      return mutate(async () => {
        if (!validId(id)) throw new MemoryGalleryError('圖片編號無效。');
        const metadata = readMemoryGalleryMetadata(value);
        const items = await read();
        const index = items.findIndex(item => item.id === id && !item.archivedAt);
        if (index < 0) throw new MemoryGalleryError('找不到這張圖片。', 404);
        const updated = { ...items[index], ...metadata, updatedAt: new Date().toISOString() };
        items[index] = updated;
        await save(items);
        return updated;
      });
    },
    archive(id: unknown) {
      return mutate(async () => {
        if (!validId(id)) throw new MemoryGalleryError('圖片編號無效。');
        const items = await read();
        const index = items.findIndex(item => item.id === id && !item.archivedAt);
        if (index < 0) throw new MemoryGalleryError('找不到這張圖片。', 404);
        items[index] = { ...items[index], archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await save(items); // Reversible unlisting: keep the asset and its archived metadata.
      });
    },
  };
}

export const memoryGalleryStore = createMemoryGalleryStore();
