import { expect, test } from '@playwright/test';

const profileUrl = 'https://www.threads.com/@archi.exam_sup';

for (const theme of ['light', 'dark']) {
  test(`community links and QR work without signing in (${theme})`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('shane-web-theme', value), theme);
    await page.goto('/community');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveTitle('社群連結｜建築師考試');
    await expect(page.getByRole('heading', { name: '社群連結', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '一起備考，也一起交流。' })).toBeVisible();
    await expect(page.locator('main form')).toHaveCount(0);
    await expect(page.getByText(/送出問題回報|登入後送出的回報/)).toHaveCount(0);
    const image = page.getByRole('img', { name: /Threads.*QR Code/ });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);

    // Test the real anchor/new-tab behavior without hitting the external social network.
    await page.context().route('https://www.threads.com/**', route => route.fulfill({ body: '<h1>Threads profile</h1>', contentType: 'text/html' }));
    for (const link of [page.getByRole('link', { name: /^前往 Threads/ }), page.getByRole('link', { name: /^開啟 archi.exam_sup/ })]) {
      await expect(link).toHaveAttribute('href', profileUrl);
      const popupPromise = page.waitForEvent('popup');
      await link.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL(profileUrl);
      await popup.close();
    }

    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`community-${theme}.png`), fullPage: true });
    const navigation = page.getByRole('navigation', { name: '主要功能', exact: true });
    if (!(await navigation.isVisible())) await page.getByRole('button', { name: '開啟選單' }).click();
    await expect(navigation.getByRole('link', { name: '社群連結', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(navigation.getByRole('link', { name: '問題回報', exact: true })).toHaveCount(0);
  });
}

test('old report bookmarks redirect to community without a report form', async ({ page }) => {
  await page.goto('/report?question=law-114-01&from=%2Fpractice%2Fquiz');
  await expect(page).toHaveURL(/\/community\?/);
  await expect(page.getByRole('heading', { name: '社群連結', exact: true })).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
});

test('the Threads post link opens the home page and says where the visit came from', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const redirect = await request.get('/threads', { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);

  await page.goto('/threads');
  await expect(page).toHaveURL(/\/\?utm_source=threads&utm_medium=social&utm_campaign=launch$/);
  await expect(page).toHaveTitle('建築師考試考古題練習平台');
});
