import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { filterMemoryGalleryImages, readMemoryGalleryMetadata, type MemoryGalleryImage } from '@/lib/memory-gallery';
import { MemoryGalleryPage } from './memory-gallery-page';

const base: MemoryGalleryImage = { id: '00000000-0000-4000-8000-000000000001', title: '防火避難整理', description: '步行距離速記', category: 'law',
  src: '/memory-gallery/assets/00000000-0000-4000-8000-000000000001.webp', thumbnailSrc: '/memory-gallery/assets/00000000-0000-4000-8000-000000000001-thumb.webp',
  width: 600, height: 900, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' };
const items: MemoryGalleryImage[] = [base, { ...base, id: '2', title: '混凝土構造', category: 'construction', description: '鋼筋接續' },
  { ...base, id: '3', title: '空調系統', category: 'env', description: '空氣線圖' }];
afterEach(cleanup);

describe('memory gallery browsing', () => {
  it('filters by all three categories and searches image titles/descriptions', () => {
    render(<MemoryGalleryPage items={items} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^構造/ }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '混凝土構造' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^全部/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '空氣線圖' } });
    expect(screen.getByRole('heading', { name: '空調系統' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not-found' } });
    expect(screen.getByText('找不到符合條件的圖片')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除篩選' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
  it('opens the image lightbox and closes it with Escape', () => {
    render(<MemoryGalleryPage items={[base]} />);
    fireEvent.click(screen.getByRole('button', { name: '放大圖片 防火避難整理' }));
    expect(screen.getByRole('dialog', { name: '放大檢視 防火避難整理' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '開啟完整圖片' })).toHaveAttribute('href', base.src);
  });
  it('shows an honest empty state, never an ordinary-user upload form', () => {
    render(<MemoryGalleryPage items={[]} />);
    expect(screen.getByText('速記圖片準備中')).toBeInTheDocument();
    expect(screen.queryByLabelText(/整理圖片/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '管理者上傳' })).toHaveAttribute('href', '/admin/memory-gallery');
  });
  it('hides archived images even if accidentally supplied to the client', () => {
    expect(filterMemoryGalleryImages([{ ...base, archivedAt: '2026-10-20T01:00:00Z' }], 'all', '')).toEqual([]);
    expect(readMemoryGalleryMetadata({ title: '  標題  ', description: ' 摘要 ', category: 'env', key: 'must-not-save' }))
      .toEqual({ title: '標題', description: '摘要', category: 'env' });
    expect(() => readMemoryGalleryMetadata({ title: 'x'.repeat(101), category: 'law' })).toThrow('標題');
    expect(() => readMemoryGalleryMetadata({ title: 'x', description: 'x'.repeat(1001), category: 'law' })).toThrow('說明');
  });
});
