import { expect, test, type Page } from '@playwright/test';

const communities = [
  {
    path: '/line', title: 'LINE 社群｜建築師考試', name: 'LINE 社群',
    url: 'https://line.me/ti/g2/OH11gDAPosXdZPLd4w4wCkQNHE6L-tZXjU7W0A', stub: 'https://line.me/**',
    button: /^加入 LINE 社群連結/, qrLink: /^開啟 LINE 社群「建築師大集結開源討論群」/, qrAlt: 'LINE 社群的 QR Code',
    text: '交流考試內容，互相解惑',
  },
  {
    path: '/threads', title: 'Threads｜建築師考試', name: 'Threads',
    url: 'https://www.threads.com/@archi.exam_sup', stub: 'https://www.threads.com/**',
    button: /^前往 Threads 連結/, qrLink: /^開啟 archi.exam_sup/, qrAlt: 'Threads 帳號 archi.exam_sup 的 QR Code',
    text: '歡迎追蹤、分享解題心得。',
  },
] as const;

async function openNavigation(page: Page) {
  const navigation = page.getByRole('navigation', { name: '主要功能', exact: true });
  // The phone drawer button can render before hydration, so retry until it opens.
  await expect(async () => {
    if (!(await navigation.isVisible())) await page.getByRole('button', { name: '開啟選單' }).click({ timeout: 1000 });
    await expect(navigation).toBeVisible({ timeout: 1000 });
  }).toPass();
  return navigation;
}

for (const community of communities) for (const theme of ['light', 'dark']) {
  test(`${community.name} page: its button and QR work without signing in (${theme})`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('shane-web-theme', value), theme);
    await page.goto(community.path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveTitle(community.title);
    await expect(page.getByRole('heading', { level: 1, name: community.name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '一起備考，也一起交流。' })).toBeVisible();
    await expect(page.locator('main form')).toHaveCount(0);
    await expect(page.getByText(/送出問題回報|登入後送出的回報/)).toHaveCount(0);
    const card = page.getByRole('article', { name: community.name, exact: true });
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(card.getByText(community.text)).toBeVisible();
    const image = page.getByRole('img', { name: community.qrAlt, exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);

    // Test the real anchor/new-tab behaviour without reaching the social network.
    await page.context().route(community.stub, route => route.fulfill({ body: '<h1>stub</h1>', contentType: 'text/html' }));
    for (const link of [page.getByRole('link', { name: community.button }), page.getByRole('link', { name: community.qrLink })]) {
      await expect(link).toHaveAttribute('href', community.url);
      const popupPromise = page.waitForEvent('popup');
      await link.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL(community.url);
      await popup.close();
    }

    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${community.path.slice(1)}-${theme}.png`), fullPage: true });
    const navigation = await openNavigation(page);
    await expect(navigation.getByRole('link', { name: community.name, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(navigation.getByRole('link', { name: '社群連結', exact: true })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: '問題回報', exact: true })).toHaveCount(0);
  });
}

test('the sidebar opens LINE 社群 and Threads as two pages', async ({ page }, testInfo) => {
  await page.goto('/privacy');
  let navigation = await openNavigation(page);
  await navigation.getByRole('link', { name: 'LINE 社群', exact: true }).click();
  await expect(page).toHaveURL(/\/line$/);
  await expect(page.getByRole('heading', { level: 1, name: 'LINE 社群', exact: true })).toBeVisible();
  // On a phone the drawer closes after the click; wait until it has, or reopening sees it mid-animation.
  if (testInfo.project.name === 'mobile') await expect(navigation).toBeHidden();
  navigation = await openNavigation(page);
  await navigation.getByRole('link', { name: 'Threads', exact: true }).click();
  await expect(page).toHaveURL(/\/threads$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Threads', exact: true })).toBeVisible();
});

test('old 社群連結 and 問題回報 bookmarks land on LINE 社群 without a report form', async ({ page }) => {
  await page.goto('/community');
  await expect(page).toHaveURL(/\/line$/);
  await expect(page.getByRole('heading', { level: 1, name: 'LINE 社群', exact: true })).toBeVisible();
  await page.goto('/report?question=law-114-01&from=%2Fpractice%2Fquiz');
  await expect(page).toHaveURL(/\/line\?/);
  await expect(page.getByRole('heading', { level: 1, name: 'LINE 社群', exact: true })).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
});
