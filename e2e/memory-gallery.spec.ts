import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { MemoryGalleryImage } from '../src/lib/memory-gallery';

const items: MemoryGalleryImage[] = ['law', 'construction', 'env'].map((category, index) => {
  const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
  return { id, title: ['法規整理測試圖', '構造整理測試圖', '環控整理測試圖'][index], description: ['防火避難', '鋼筋接續', '空氣線圖'][index],
    category: category as MemoryGalleryImage['category'], src: `/memory-gallery/assets/${id}.webp`, thumbnailSrc: `/memory-gallery/assets/${id}-thumb.webp`,
    width: 700, height: 900, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' };
});
async function fixtureImage() {
  return sharp(Buffer.from('<svg width="700" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="700" height="900" fill="#edf3ff"/><rect x="55" y="70" width="590" height="100" rx="12" fill="#b5cbf8"/><path d="M65 240H630M65 320H630M65 400H630M65 480H630M65 560H630" stroke="#879fc4" stroke-width="8"/></svg>')).png().toBuffer();
}
async function routeImages(page: Page) {
  const image = await fixtureImage();
  await page.route('**/memory-gallery/assets/**', route => route.fulfill({ contentType: 'image/png', body: image }));
  await page.route('**/_next/image?*', route => route.fulfill({ contentType: 'image/png', body: image }));
  return image;
}
async function enterGallery(page: Page) {
  await page.goto('/');
  const menu = page.getByRole('button', { name: '開啟選單' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: '速記圖庫', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(0);
}

test('gallery is publicly accessible from navigation without exposing an upload form', async ({ page }, testInfo) => {
  await enterGallery(page);
  const gallery = page.getByRole('region', { name: '速記圖庫', exact: true });
  await expect(gallery.getByRole('group', { name: '圖片分類' })).toBeVisible();
  await expect(gallery.getByRole('link', { name: '管理者上傳' })).toBeVisible();
  await expect(gallery.locator('input[type=file]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('gallery-empty.png'), fullPage: true });
});

test('public gallery filters, searches and enlarges images on desktop and mobile', async ({ page }, testInfo) => {
  await routeImages(page);
  await page.route('**/_next/data/**/memory-gallery.json*', route => route.fulfill({ json: { pageProps: { items }, __N_SSG: true } }));
  await enterGallery(page);
  const gallery = page.getByRole('region', { name: '速記圖庫', exact: true });
  await expect(gallery.getByRole('article')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('gallery-populated.png'), fullPage: true });
  await gallery.getByRole('button', { name: /^構造/ }).click();
  await expect(gallery.getByRole('article')).toHaveCount(1);
  await expect(gallery.getByRole('heading', { name: '構造整理測試圖' })).toBeVisible();
  await gallery.getByRole('button', { name: /^全部/ }).click();
  await gallery.getByRole('searchbox').fill('空氣線圖');
  await expect(gallery.getByRole('article')).toHaveCount(1);
  await gallery.getByRole('button', { name: '放大圖片 環控整理測試圖' }).click();
  const dialog = page.getByRole('dialog', { name: '放大檢視 環控整理測試圖' });
  await expect(dialog.getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('admin uploads, edits and unlists with a key and clear deployment instructions', async ({ page }, testInfo) => {
  const image = await routeImages(page);
  await page.route('**/api/admin/verify-key', route => route.fulfill({ json: { ok: true } }));
  let current = { ...items[0], title: '新上傳測試圖' };
  await page.route('**/api/admin/memory-gallery', async route => {
    expect(route.request().headers()['x-author-key']).toBe('gallery-e2e-key');
    const body = route.request().postDataJSON();
    if (route.request().method() === 'POST') expect(body.dataUrl).toMatch(/^data:image\/png;base64,/);
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ok: true } });
    current = { ...current, title: body.title, description: body.description, category: body.category };
    return route.fulfill({ json: { item: current } });
  });
  await page.goto('/admin/memory-gallery');
  await expect(page.getByRole('form', { name: '上傳速記圖片' })).toHaveCount(0);
  await page.getByLabel('管理者金鑰（AUTHOR_EDIT_KEY）').fill('gallery-e2e-key');
  await page.getByRole('button', { name: '進入圖庫管理' }).click();
  await page.getByLabel('分類', { exact: true }).selectOption('construction');
  await page.getByLabel(/整理圖片/).setInputFiles({ name: '新上傳測試圖.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: '上傳並儲存圖片' }).click();
  await expect(page.getByRole('button', { name: '編輯 新上傳測試圖' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('commit／push');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('gallery-admin.png'), fullPage: true });
  await page.getByRole('button', { name: '編輯 新上傳測試圖' }).click();
  await page.getByLabel('圖片標題', { exact: true }).fill('編輯後測試圖');
  await page.getByLabel('分類', { exact: true }).selectOption('env');
  await page.getByRole('button', { name: '儲存圖片資料' }).click();
  await page.getByRole('button', { name: '下架 編輯後測試圖' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('原圖及索引保留');
  await page.getByRole('button', { name: '確認下架' }).click();
  await expect(page.getByRole('button', { name: '下架 編輯後測試圖' })).toHaveCount(0);
  await page.getByRole('button', { name: '鎖定後台' }).click();
  await expect(page.getByLabel('管理者金鑰（AUTHOR_EDIT_KEY）')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('a wrong admin key keeps the upload form locked', async ({ page }) => {
  await page.route('**/api/admin/verify-key', route => route.fulfill({ status: 401, json: { error: '測試金鑰不正確' } }));
  await page.goto('/admin/memory-gallery');
  await page.getByLabel('管理者金鑰（AUTHOR_EDIT_KEY）').fill('wrong');
  await page.getByRole('button', { name: '進入圖庫管理' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '金鑰不正確' })).toBeVisible();
  await expect(page.getByRole('form', { name: '上傳速記圖片' })).toHaveCount(0);
});

test('the real upload endpoint never mutates the index for unauthenticated requests', async ({ request }) => {
  const before = await readFile('data/memory-gallery.json', 'utf8');
  const response = await request.post('/api/admin/memory-gallery', { data: { title: 'not authorized', category: 'law' } });
  expect([401, 503]).toContain(response.status());
  expect(await readFile('data/memory-gallery.json', 'utf8')).toBe(before);
});
