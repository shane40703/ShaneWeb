import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import { MemoryGalleryAdminPage } from './memory-gallery-admin-page';
const item: MemoryGalleryImage = { id: '00000000-0000-4000-8000-000000000001', title: '法規整理', description: '', category: 'law',
  src: '/memory-gallery/assets/00000000-0000-4000-8000-000000000001.webp', thumbnailSrc: '/memory-gallery/assets/00000000-0000-4000-8000-000000000001-thumb.webp',
  width: 600, height: 900, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' };
const fetchMock = vi.fn();
const OriginalURL = URL;
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = vi.fn(() => 'blob:preview'); static revokeObjectURL = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function result(body: unknown, ok = true) { return { ok, json: async () => body }; }
async function unlock() {
  fireEvent.change(screen.getByLabelText('管理者金鑰（AUTHOR_EDIT_KEY）'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByRole('button', { name: '進入圖庫管理' }));
  await screen.findByRole('form', { name: '上傳速記圖片' });
}

describe('memory gallery author interface', () => {
  it('blocks the editor on the deployed website and explains the local workflow', () => {
    render(<MemoryGalleryAdminPage initialItems={[]} editingAvailable={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('http://localhost:3000/admin/memory-gallery');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
  it('keeps the upload form locked on a failed key verification', async () => {
    fetchMock.mockResolvedValue(result({ error: '金鑰錯誤' }, false));
    render(<MemoryGalleryAdminPage initialItems={[]} editingAvailable />);
    fireEvent.change(screen.getByLabelText('管理者金鑰（AUTHOR_EDIT_KEY）'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '進入圖庫管理' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('金鑰錯誤');
    expect(screen.queryByRole('form', { name: '上傳速記圖片' })).not.toBeInTheDocument();
  });
  it('uploads with a server-verified key, category and file, and never saves the key locally', async () => {
    fetchMock.mockResolvedValueOnce(result({ ok: true })).mockResolvedValueOnce(result({ item: { ...item, title: '分類整理', category: 'structure' } }));
    render(<MemoryGalleryAdminPage initialItems={[]} editingAvailable />);
    await unlock();
    expect(screen.getByRole('option', { name: '結構' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('分類'), { target: { value: 'structure' } });
    fireEvent.change(screen.getByLabelText(/整理圖片/), { target: { files: [new File(['pixels'], '分類整理.png', { type: 'image/png' })] } });
    expect(screen.getByRole('textbox', { name: '圖片標題' })).toHaveValue('分類整理');
    fireEvent.click(screen.getByRole('button', { name: '上傳並儲存圖片' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/admin/memory-gallery');
    expect(init.headers['X-Author-Key']).toBe('test-key');
    expect(JSON.parse(init.body)).toMatchObject({ title: '分類整理', category: 'structure', dataUrl: expect.stringContaining('data:image/png;base64,') });
    expect(await screen.findByRole('status')).toHaveTextContent('commit／push');
    expect(screen.getByRole('button', { name: '編輯 分類整理' })).toBeInTheDocument();
    expect(JSON.stringify(window.localStorage)).not.toContain('test-key');
  });
  it('rejects unsupported files before any upload request', async () => {
    fetchMock.mockResolvedValue(result({ ok: true }));
    render(<MemoryGalleryAdminPage initialItems={[]} editingAvailable />);
    await unlock();
    fireEvent.change(screen.getByLabelText(/整理圖片/), { target: { files: [new File(['svg'], 'x.svg', { type: 'image/svg+xml' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('PNG、JPEG 或 WebP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('edits category and title without reuploading an image, and locking clears the key', async () => {
    fetchMock.mockResolvedValueOnce(result({ ok: true })).mockResolvedValueOnce(result({ item: { ...item, title: '更新', category: 'structure' } }));
    render(<MemoryGalleryAdminPage initialItems={[item]} editingAvailable />);
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: '編輯 法規整理' }));
    fireEvent.change(screen.getByLabelText('分類'), { target: { value: 'structure' } });
    fireEvent.change(screen.getByLabelText('圖片標題'), { target: { value: '更新' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存圖片資料' }));
    await screen.findByRole('status');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ id: item.id, title: '更新', description: '', category: 'structure' });
    fireEvent.click(screen.getByRole('button', { name: '鎖定後台' }));
    expect(screen.getByLabelText('管理者金鑰（AUTHOR_EDIT_KEY）')).toHaveValue('');
  });
  it('requires confirmation to unlist and explains how the original is retained', async () => {
    fetchMock.mockResolvedValueOnce(result({ ok: true })).mockResolvedValueOnce(result({ ok: true }));
    render(<MemoryGalleryAdminPage initialItems={[item]} editingAvailable />);
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: '下架 法規整理' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('原圖及索引保留');
    fireEvent.click(screen.getByRole('button', { name: '確認下架' }));
    await screen.findByRole('status');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(screen.queryByRole('button', { name: '下架 法規整理' })).not.toBeInTheDocument();
  });
});
