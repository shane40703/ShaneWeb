import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { MemoryGalleryImage } from '../src/lib/memory-gallery';

const items: MemoryGalleryImage[] = ['law', 'construction', 'env', 'structure'].map((category, index) => {
  const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
  return { id, title: ['法規整理測試圖', '構造整理測試圖', '環控整理測試圖', '結構整理測試圖'][index], description: ['防火避難', '鋼筋接續', '空氣線圖', '梁柱受力'][index],
    category: category as MemoryGalleryImage['category'], src: `/memory-gallery/assets/${id}.webp`, thumbnailSrc: `/memory-gallery/assets/${id}-thumb.webp`,
    width: index === 3 ? 900 : 700, height: index === 3 ? 450 : 900, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z' };
});
async function fixtureImage(width = 700, height = 900) {
  return sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#edf3ff"/><rect x="55" y="70" width="590" height="100" rx="12" fill="#b5cbf8"/><path d="M65 240H630M65 320H630M65 400H630M65 480H630M65 560H630" stroke="#879fc4" stroke-width="8"/></svg>`)).png().toBuffer();
}
async function routeImages(page: Page) {
  const image = await fixtureImage();
  const landscape = await fixtureImage(900, 450);
  for (const pattern of ['**/memory-gallery/assets/**', '**/_next/image?*']) {
    await page.route(pattern, route => route.fulfill({ contentType: 'image/png', body: route.request().url().includes(items[3].id) ? landscape : image }));
  }
  return image;
}
async function enterGallery(page: Page) {
  await page.goto('/');
  const menu = page.getByRole('button', { name: '開啟選單' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: '歷屆試題資料集成', exact: true }).click();
  await page.getByRole('link', { name: '速記圖庫', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(0);
}
async function enterPopulatedGallery(page: Page) {
  await routeImages(page);
  await page.route('**/_next/data/**/memory-gallery.json*', route => route.fulfill({ json: { pageProps: { items }, __N_SSG: true } }));
  await enterGallery(page);
  return page.getByRole('region', { name: '速記圖庫', exact: true });
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
  const gallery = await enterPopulatedGallery(page);
  const categories = gallery.getByRole('group', { name: '圖片分類' });
  await expect(categories.getByRole('button')).toHaveCount(4);
  await expect(categories.getByRole('button', { name: /^全部/ })).toHaveCount(0);
  await expect(categories.getByRole('button', { name: /^法規/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(gallery.getByRole('article')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('gallery-populated.png'), fullPage: true });
  await gallery.getByRole('button', { name: /^構造/ }).click();
  await expect(gallery.getByRole('article')).toHaveCount(1);
  await expect(gallery.getByRole('heading', { name: '構造整理測試圖' })).toBeVisible();
  await gallery.getByRole('button', { name: /^結構/ }).click();
  await expect(gallery.getByRole('heading', { name: '結構整理測試圖' })).toBeVisible();
  await gallery.getByRole('searchbox').fill('空氣線圖');
  await expect(gallery.getByRole('article')).toHaveCount(0);
  await gallery.getByRole('button', { name: /^環控/ }).click();
  await expect(gallery.getByRole('article')).toHaveCount(1);
  await gallery.getByRole('button', { name: '放大圖片 環控整理測試圖' }).click();
  const dialog = page.getByRole('dialog', { name: '放大檢視 環控整理測試圖' });
  await expect(dialog.getByRole('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('portrait and landscape previews fill the card width without padding or cropping', async ({ page }, testInfo) => {
  const gallery = await enterPopulatedGallery(page);
  for (const item of [items[0], items[3]]) {
    await gallery.getByRole('button', { name: item.category === 'law' ? /^法規/ : /^結構/ }).click();
    const image = gallery.getByRole('img', { name: item.title, exact: true });
    await expect(image).toHaveAttribute('src', item.src);
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(item.width);
    const size = await image.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const frame = node.parentElement!.getBoundingClientRect();
      return { width: rect.width, height: rect.height, frameWidth: frame.width, frameHeight: frame.height };
    });
    expect(Math.abs(size.width - size.frameWidth)).toBeLessThan(1);
    expect(Math.abs(size.height - size.frameHeight)).toBeLessThan(1);
    expect(Math.abs(size.height - size.width * item.height / item.width)).toBeLessThan(1);
    await page.screenshot({ path: testInfo.outputPath(`gallery-full-width-${item.category}.png`), fullPage: true });
    await gallery.getByRole('button', { name: `放大圖片 ${item.title}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `放大檢視 ${item.title}` });
    await expect(dialog.getByRole('slider')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('gallery zoom controls stay accessible and block ordinary image saving', async ({ page }, testInfo) => {
  const gallery = await enterPopulatedGallery(page);
  expect(await gallery.locator('a[href*="/memory-gallery/assets/"]').count()).toBe(0);
  const thumbnail = gallery.getByRole('img').first();
  await expect(thumbnail).toHaveAttribute('draggable', 'false');
  expect(await thumbnail.evaluate(image => !image.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  expect(await thumbnail.evaluate(image => !image.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true })))).toBe(true);
  const trigger = gallery.getByRole('button', { name: '放大圖片 法規整理測試圖', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '放大檢視 法規整理測試圖' });
  const image = dialog.getByRole('img');
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(image).toHaveAttribute('draggable', 'false');
  const slider = dialog.getByRole('slider', { name: '圖片縮放比例' });
  await dialog.getByRole('button', { name: '放大圖片', exact: true }).click();
  await expect(slider).toHaveValue('125');
  await slider.focus();
  await slider.press('End');
  await expect(slider).toHaveValue('800');
  await expect(dialog.getByRole('button', { name: '放大圖片', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '符合畫面' }).click();
  await expect(slider).toHaveValue('100');
  const viewport = dialog.getByRole('region', { name: '圖片縮放與拖曳區' });
  await viewport.focus();
  await viewport.press('+');
  await expect(slider).toHaveValue('125');
  expect(await viewport.evaluate(node => !node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  expect(await viewport.evaluate(node => !node.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true })))).toBe(true);
  expect(await dialog.evaluate(node => !node.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('gallery-zoom.png') });
  for (let index = 0; index < 9; index++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole('slider')).toHaveValue('100');
  await page.emulateMedia({ media: 'print' });
  await expect(dialog).toBeHidden();
  await expect(page.locator('article img').first()).toHaveCSS('visibility', 'hidden');
  await page.emulateMedia({ media: 'screen' });
  await expect(dialog).toBeVisible();
});

test('desktop wheel zoom and captured mouse dragging keep the page still', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse/trackpad interaction is covered in the desktop project.');
  const gallery = await enterPopulatedGallery(page);
  await gallery.getByRole('button', { name: '放大圖片 法規整理測試圖', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '放大檢視 法規整理測試圖' });
  const viewport = dialog.getByRole('region', { name: '圖片縮放與拖曳區' });
  const slider = dialog.getByRole('slider');
  const rect = (await viewport.boundingBox())!;
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await slider.focus();
  await slider.press('End');
  const transform = dialog.getByRole('img').locator('..');
  const before = await transform.getAttribute('style');
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 75, rect.y + rect.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  expect(await transform.getAttribute('style')).not.toBe(before);
  await expect(slider).toHaveValue('800');
  await dialog.getByRole('button', { name: '符合畫面' }).click();
  await expect(transform).toHaveAttribute('style', 'transform: translate(0px, 0px) scale(1);');
  await viewport.dblclick();
  await expect(slider).toHaveValue('250');
  await viewport.dblclick();
  await expect(slider).toHaveValue('100');
});

test('mobile two-finger pinch and single-finger pan work inside the image', async ({ page, isMobile, context }) => {
  test.skip(!isMobile, 'Real touch contacts are covered in the mobile project.');
  const gallery = await enterPopulatedGallery(page);
  await gallery.getByRole('button', { name: '放大圖片 法規整理測試圖', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '放大檢視 法規整理測試圖' });
  const viewport = dialog.getByRole('region', { name: '圖片縮放與拖曳區' });
  const rect = (await viewport.boundingBox())!;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await expect(viewport).toHaveCSS('touch-action', 'none');
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: x - 35, y }, { id: 2, x: x + 35, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x - 70, y }, { id: 2, x: x + 70, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dialog.getByRole('slider')).toHaveValue('200');
    const transform = dialog.getByRole('img').locator('..');
    const before = await transform.getAttribute('style');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 3, x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 3, x: x + 40, y: y + 55 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    expect(await transform.getAttribute('style')).not.toBe(before);
    await dialog.getByRole('button', { name: '符合畫面' }).click();
    await expect(dialog.getByRole('slider')).toHaveValue('100');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  } finally { await cdp.detach(); }
});

test('admin uploads, edits and unlists with a key and clear deployment instructions', async ({ page }, testInfo) => {
  const image = await routeImages(page);
  await page.route('**/api/admin/verify-key', route => route.fulfill({ json: { ok: true } }));
  let current = { ...items[0], title: '新上傳測試圖' };
  await page.route('**/api/admin/memory-gallery', async route => {
    expect(route.request().headers()['x-author-key']).toBe('gallery-e2e-key');
    const body = route.request().postDataJSON();
    if (route.request().method() === 'POST') {
      expect(body.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(body.category).toBe('structure');
    }
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { ok: true } });
    current = { ...current, title: body.title, description: body.description, category: body.category };
    return route.fulfill({ json: { item: current } });
  });
  await page.goto('/admin/memory-gallery');
  await expect(page.getByRole('form', { name: '上傳速記圖片' })).toHaveCount(0);
  await page.getByLabel('管理者金鑰（AUTHOR_EDIT_KEY）').fill('gallery-e2e-key');
  await page.getByRole('button', { name: '進入圖庫管理' }).click();
  await page.getByLabel('分類', { exact: true }).selectOption('structure');
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
