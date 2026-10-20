import { timingSafeEqual } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { canEditMemoryGallery, MemoryGalleryError, memoryGalleryStore } from '@/server/memory-gallery.server';

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method ?? '')) {
    response.setHeader('Allow', 'POST, PATCH, DELETE');
    return response.status(405).json({ error: '僅支援 POST、PATCH 或 DELETE。' });
  }
  if (!canEditMemoryGallery()) return response.status(503).json({ error: '請在本機 npm run dev 上傳，完成後 commit／push 發布圖庫。正式網站不支援寫入專案檔案。' });
  const configuredKey = process.env.AUTHOR_EDIT_KEY?.trim();
  if (!configuredKey) return response.status(503).json({ error: '伺服器尚未設定 AUTHOR_EDIT_KEY。' });
  const suppliedKey = request.headers['x-author-key'];
  const supplied = Buffer.from(typeof suppliedKey === 'string' ? suppliedKey : '');
  const expected = Buffer.from(configuredKey);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return response.status(401).json({ error: '管理者編輯金鑰不正確。' });
  }
  if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`) {
    return response.status(403).json({ error: '僅允許從同一網站操作圖庫。' });
  }
  try {
    if (request.method === 'POST') return response.status(201).json({ item: await memoryGalleryStore.upload(request.body) });
    if (request.method === 'PATCH') return response.status(200).json({ item: await memoryGalleryStore.update(request.body?.id, request.body) });
    await memoryGalleryStore.archive(request.body?.id);
    return response.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof MemoryGalleryError) return response.status(error.status).json({ error: error.message });
    if (error instanceof Error && /^(請填寫|圖片說明|請選擇|圖庫資料)/.test(error.message)) return response.status(400).json({ error: error.message });
    return response.status(500).json({ error: '圖庫儲存失敗，請檢查本機索引及專案寫入權限；現有圖庫不會被清空。' });
  }
}
