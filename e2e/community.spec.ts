import { expect, test } from '@playwright/test';

const profileUrl = 'https://www.threads.com/@archi.exam_sup';
const lineUrl = 'https://line.me/ti/g2/OH11gDAPosXdZPLd4w4wCkQNHE6L-tZXjU7W0A';

for (const theme of ['light', 'dark']) {
  test(`community links and QR work without signing in (${theme})`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('shane-web-theme', value), theme);
    await page.goto('/community');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveTitle('社群連結｜建築師考試');
    await expect(page.getByRole('heading', { name: '社群連結', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '一起備考，也一起交流。' })).toBeVisible();
    await expect(page.getByText('在 Threads 追蹤網站動態、交流備考心得；想一起把網站做得更好，歡迎加入 LINE 開源社群。')).toBeVisible();
    await expect(page.locator('main form')).toHaveCount(0);
    await expect(page.getByText(/送出問題回報|登入後送出的回報/)).toHaveCount(0);
    const threadsCard = page.getByRole('article', { name: 'Threads', exact: true });
    const lineCard = page.getByRole('article', { name: 'LINE 開源社群', exact: true });
    await expect(threadsCard.getByText('歡迎追蹤、分享解題心得。')).toBeVisible();
    await expect(lineCard.getByText('這是建築師大集結的開源社群。')).toBeVisible();
    await expect(lineCard.getByText('建築師大集結開源討論群', { exact: true })).toBeVisible();
    // The LINE card sits below the Threads card.
    const [threadsBox, lineBox] = await Promise.all([threadsCard.boundingBox(), lineCard.boundingBox()]);
    expect(lineBox!.y).toBeGreaterThanOrEqual(threadsBox!.y + threadsBox!.height);
    for (const name of ['Threads 帳號 archi.exam_sup 的 QR Code', 'LINE 開源社群的 QR Code']) {
      const image = page.getByRole('img', { name, exact: true });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    }

    // Test the real anchor/new-tab behavior without hitting the external social networks.
    await page.context().route('https://www.threads.com/**', route => route.fulfill({ body: '<h1>Threads profile</h1>', contentType: 'text/html' }));
    await page.context().route('https://line.me/**', route => route.fulfill({ body: '<h1>LINE OpenChat</h1>', contentType: 'text/html' }));
    const targets = [
      { url: profileUrl, links: [page.getByRole('link', { name: /^前往 Threads/ }), page.getByRole('link', { name: /^開啟 archi.exam_sup/ })] },
      { url: lineUrl, links: [page.getByRole('link', { name: /^加入 LINE 開源社群/ }), page.getByRole('link', { name: /^開啟 LINE 開源社群「建築師大集結開源討論群」/ })] },
    ];
    for (const { url, links } of targets) for (const link of links) {
      await expect(link).toHaveAttribute('href', url);
      const popupPromise = page.waitForEvent('popup');
      await link.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL(url);
      await popup.close();
    }

    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`community-${theme}.png`), fullPage: true });
    const navigation = page.getByRole('navigation', { name: '主要功能', exact: true });
    // The phone drawer button can render before hydration, so retry until it opens.
    await expect(async () => {
      if (!(await navigation.isVisible())) await page.getByRole('button', { name: '開啟選單' }).click({ timeout: 1000 });
      await expect(navigation).toBeVisible({ timeout: 1000 });
    }).toPass();
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
