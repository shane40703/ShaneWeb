import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMORY_GALLERY_CATEGORIES, filterMemoryGalleryImages, readMemoryGalleryMetadata, type MemoryGalleryImage } from '@/lib/memory-gallery';
import { subjects } from '@/question-bank/catalog';
import { MemoryGalleryPage } from './memory-gallery-page';

const base: MemoryGalleryImage = { id: '00000000-0000-4000-8000-000000000001', title: '防火避難整理', description: '步行距離速記', category: 'law',
  src: '/memory-gallery/assets/00000000-0000-4000-8000-000000000001.webp', thumbnailSrc: '/memory-gallery/assets/00000000-0000-4000-8000-000000000001-thumb.webp',
  width: 600, height: 900, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' };
const items: MemoryGalleryImage[] = [base, { ...base, id: '2', title: '混凝土構造', category: 'construction', description: '鋼筋接續' },
  { ...base, id: '3', title: '空調系統', category: 'env', description: '空氣線圖' },
  { ...base, id: '4', title: '結構力學', category: 'structure', description: '梁柱受力' }];
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('memory gallery browsing', () => {
  it('defaults to law, offers exactly four subjects without all, and searches only the selected subject', () => {
    render(<MemoryGalleryPage items={items} />);
    const categories = within(screen.getByRole('group', { name: '圖片分類' }));
    expect(categories.getAllByRole('button')).toHaveLength(4);
    expect(categories.queryByRole('button', { name: /^全部/ })).not.toBeInTheDocument();
    expect(categories.getByRole('button', { name: /^法規/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '防火避難整理' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^構造/ }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '混凝土構造' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^結構/ }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '結構力學' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '空氣線圖' } });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^環控/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '空氣線圖' } });
    expect(screen.getByRole('heading', { name: '空調系統' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not-found' } });
    expect(screen.getByText('找不到符合條件的圖片')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除搜尋' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(categories.getByRole('button', { name: /^環控/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('explains an empty subject without showing another subject or an all-category reset', () => {
    render(<MemoryGalleryPage items={[base]} />);
    fireEvent.click(screen.getByRole('button', { name: /^結構/ }));
    expect(screen.getByText('結構圖片準備中')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清除搜尋' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^結構/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('uses the full-resolution image and intrinsic dimensions for uncropped full-width previews', () => {
    render(<MemoryGalleryPage items={[base]} />);
    const image = screen.getByRole('img', { name: base.title });
    expect(image).toHaveAttribute('src', base.src);
    expect(image).toHaveAttribute('width', String(base.width));
    expect(image).toHaveAttribute('height', String(base.height));
  });
  it('opens the image lightbox, restores trigger focus, and never links to raw images', async () => {
    const user = userEvent.setup();
    render(<MemoryGalleryPage items={[base]} />);
    const trigger = screen.getByRole('button', { name: '放大圖片 防火避難整理' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: '放大檢視 防火避難整理' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('link', { name: '開啟完整圖片' })).not.toBeInTheDocument();
    expect(document.querySelector(`a[href="${base.src}"]`)).toBeNull();
  });
  it('supports continuous zoom, button limits, fitting, and resets zoom on reopen', async () => {
    const user = userEvent.setup();
    render(<MemoryGalleryPage items={[base]} />);
    await user.click(screen.getByRole('button', { name: '放大圖片 防火避難整理' }));
    const dialog = within(await screen.findByRole('dialog'));
    const slider = dialog.getByRole('slider', { name: '圖片縮放比例' });
    expect(dialog.getByRole('button', { name: '縮小圖片' })).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: '放大圖片' }));
    expect(slider).toHaveValue('125');
    fireEvent.change(slider, { target: { value: '347' } });
    expect(dialog.getByLabelText('目前縮放比例')).toHaveTextContent('347%');
    fireEvent.change(slider, { target: { value: '800' } });
    expect(dialog.getByRole('button', { name: '放大圖片' })).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: '符合畫面' }));
    expect(slider).toHaveValue('100');
    fireEvent.change(slider, { target: { value: '400' } });
    await user.click(dialog.getByRole('button', { name: '關閉放大圖片' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '放大圖片 防火避難整理' }));
    expect(within(await screen.findByRole('dialog')).getByRole('slider')).toHaveValue('100');
  });
  it('zooms with a non-passive wheel listener and viewport keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<MemoryGalleryPage items={[base]} />);
    await user.click(screen.getByRole('button', { name: '放大圖片 防火避難整理' }));
    const dialog = within(await screen.findByRole('dialog'));
    const viewport = dialog.getByRole('region', { name: '圖片縮放與拖曳區' });
    expect(fireEvent.wheel(viewport, { deltaY: -400, clientX: 400, clientY: 300, cancelable: true })).toBe(false);
    expect(Number((dialog.getByRole('slider') as HTMLInputElement).value)).toBeGreaterThan(100);
    fireEvent.keyDown(viewport, { key: '0' });
    expect(dialog.getByRole('slider')).toHaveValue('100');
    fireEvent.keyDown(viewport, { key: '+' });
    expect(dialog.getByRole('slider')).toHaveValue('125');
    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(dialog.getByRole('slider')).toHaveValue('100');
    fireEvent.doubleClick(viewport, { clientX: 400, clientY: 300 });
    expect(dialog.getByRole('slider')).toHaveValue('250');
  });
  it('blocks ordinary context-menu saving, dragging, copying, and in-viewer save shortcuts', async () => {
    const user = userEvent.setup();
    render(<MemoryGalleryPage items={[base]} />);
    const thumbnail = screen.getByRole('img');
    expect(thumbnail).toHaveAttribute('draggable', 'false');
    expect(fireEvent.contextMenu(thumbnail)).toBe(false);
    expect(fireEvent.dragStart(thumbnail)).toBe(false);
    await user.click(screen.getByRole('button', { name: '放大圖片 防火避難整理' }));
    const popup = await screen.findByRole('dialog');
    const dialog = within(popup);
    const viewport = dialog.getByRole('region', { name: '圖片縮放與拖曳區' });
    expect(dialog.getByRole('img')).toHaveAttribute('draggable', 'false');
    expect(fireEvent.contextMenu(viewport)).toBe(false);
    expect(fireEvent.dragStart(viewport)).toBe(false);
    expect(fireEvent.copy(viewport)).toBe(false);
    expect(fireEvent.keyDown(popup, { key: 's', ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(popup, { key: 's', metaKey: true })).toBe(false);
    fireEvent.error(dialog.getByRole('img'));
    expect(within(viewport).getByRole('status')).toHaveTextContent('圖片載入失敗');
  });
  it('shows an honest empty state, never an ordinary-user upload form', () => {
    render(<MemoryGalleryPage items={[]} />);
    expect(screen.getByText('速記圖片準備中')).toBeInTheDocument();
    expect(screen.queryByLabelText(/整理圖片/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '管理者上傳' })).toHaveAttribute('href', '/admin/memory-gallery');
  });
  it('hides archived images even if accidentally supplied to the client', () => {
    expect(filterMemoryGalleryImages([{ ...base, archivedAt: '2026-10-20T01:00:00Z' }], 'law', '')).toEqual([]);
    expect(readMemoryGalleryMetadata({ title: '  標題  ', description: ' 摘要 ', category: 'env', key: 'must-not-save' }))
      .toEqual({ title: '標題', description: '摘要', category: 'env' });
    expect(readMemoryGalleryMetadata({ title: '結構力學', category: 'structure' })).toEqual({ title: '結構力學', description: '', category: 'structure' });
    expect(() => readMemoryGalleryMetadata({ title: 'x', category: 'all' })).toThrow('請選擇');
    expect(() => readMemoryGalleryMetadata({ title: 'x'.repeat(101), category: 'law' })).toThrow('標題');
    expect(() => readMemoryGalleryMetadata({ title: 'x', description: 'x'.repeat(1001), category: 'law' })).toThrow('說明');
  });
});

describe('memory gallery on the resources hub (新版)', () => {
  const href = (category: string) => `/resources/memory-gallery/${category}`;
  it('turns subjects into links to their own pages and shows the subject its page is for', () => {
    render(<MemoryGalleryPage items={items} category="construction" categoryHref={href} />);
    const categories = within(screen.getByRole('group', { name: '圖片分類' }));
    expect(categories.queryAllByRole('button')).toHaveLength(0);
    expect(categories.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['law', 'env', 'construction', 'structure'].map(href));
    expect(categories.getByRole('link', { name: /^構造/ })).toHaveAttribute('aria-current', 'page');
    expect(categories.getByRole('link', { name: /^法規/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('article')).toHaveAttribute('id', 'memory-2');
    expect(screen.getByRole('heading', { name: '混凝土構造' })).toBeInTheDocument();
  });
  it('can leave its heading to the hub without skipping a heading level', () => {
    render(<MemoryGalleryPage items={items} showHeader={false} category="law" categoryHref={href} />);
    expect(screen.getByRole('region', { name: '速記圖庫' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '速記圖庫' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '管理者上傳' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '防火避難整理' })).toBeInTheDocument();
  });
  it('keeps image titles one level below its own heading', () => {
    render(<MemoryGalleryPage items={items} />);
    expect(screen.getByRole('heading', { level: 2, name: '速記圖庫' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '防火避難整理' })).toBeInTheDocument();
  });
  it('lists subjects in the subject catalog order', () => {
    expect(MEMORY_GALLERY_CATEGORIES.map(category => [category.id, category.label])).toEqual(subjects.map(subject => [subject.id, subject.shortName]));
    render(<MemoryGalleryPage items={items} />);
    expect(within(screen.getByRole('group', { name: '圖片分類' })).getAllByRole('button').map(button => button.textContent))
      .toEqual(['法規1', '環控1', '構造1', '結構1']);
  });
  it('hides the upload link on the production site, where uploading cannot work', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<MemoryGalleryPage items={items} />);
    expect(screen.queryByRole('link', { name: '管理者上傳' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '速記圖庫' })).toBeInTheDocument();
  });
});
