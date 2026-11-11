import { expect, test, type Page } from '@playwright/test';

async function openNavigation(page: Page) {
  const nav = page.getByRole('navigation', { name: '主要功能', exact: true });
  // The phone drawer button can render before hydration, so retry until it opens.
  await expect(async () => {
    if (!(await nav.isVisible()))
      await page.getByRole('button', { name: '開啟選單' }).click({ timeout: 1000 });
    await expect(nav).toBeVisible({ timeout: 1000 });
  }).toPass();
  return nav;
}

const topbarTitle = (page: Page) =>
  page.getByRole('heading', { level: 1, name: '開源授權', exact: true });

for (const theme of ['light', 'dark']) {
  test(`開源授權 explains every licence and fits a phone (${theme})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      (value) => localStorage.setItem('shane-web-theme', value),
      theme,
    );
    await page.goto('/licenses');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page).toHaveTitle('開源授權｜建築師考試');
    await expect(topbarTitle(page)).toBeVisible();

    const sheet = page.locator('main article');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText([
      '網站程式碼',
      '字型',
      '考古題與法規',
      '網站圖示',
      '第三方套件',
    ]);
    await expect(sheet).toContainText('GNU Affero 通用公共授權條款第 3 版（AGPL v3）');
    await expect(sheet).toContainText('速記圖庫的整理圖由網站作者製作，也採用這個授權。');
    await expect(sheet).toContainText('依著作權法第 9 條');

    for (const [name, href] of [
      ['原始碼', 'https://github.com/shane40703/ShaneWeb'],
      ['授權條款全文', 'https://www.gnu.org/licenses/agpl-3.0.html'],
    ]) {
      // The arrow is decoration; the hidden words say where the link opens.
      const link = sheet.getByRole('link', {
        name: new RegExp(`^${name}\\s*（另開新分頁）$`),
      });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    for (const [font, file] of [
      ['Shane Daily Paper Ming', '/fonts/daily-paper/OFL.txt'],
      ['Tinos', '/fonts/daily-paper/OFL-Tinos.txt'],
    ]) {
      const link = sheet.getByRole('link', {
        name: new RegExp(`^授權全文\\s*（${font}）$`),
      });
      await expect(link).toHaveAttribute('href', file);
      expect((await page.request.get(file)).status()).toBe(200);
    }

    if (testInfo.project.name === 'mobile')
      await page.setViewportSize({ width: 320, height: 800 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`licenses-${theme}.png`),
      fullPage: true,
    });
  });
}

test('第三方套件 opens each licence text and still fits a phone', async ({
  page,
}, testInfo) => {
  await page.goto('/licenses');
  const section = page
    .locator('main article section')
    .filter({ has: page.getByRole('heading', { level: 2, name: '第三方套件' }) });
  await expect(section).toBeVisible();
  // `next dev` reads the list the last production build wrote to .next; without one the page
  // only says where the list comes from, and there is nothing here to check.
  const packages = section.getByRole('list', { name: '第三方套件' });
  test.skip(
    (await packages.count()) === 0,
    'No .next/third-party-licenses.json yet: run `npx next build --webpack` first.',
  );

  await expect(section).toContainText(/包含下面 \d+ 個開源套件/);
  await expect(
    packages.locator('summary', { hasText: /^@tabler\/icons-react/ }),
  ).toHaveCount(1);
  const row = (name: RegExp) =>
    packages
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: name }) });
  const react = row(/^react\d/);
  await react.locator('summary').click();
  await expect(react.locator('pre')).toContainText('Permission is hereby granted');
  // The longest texts: a standard Apache-2.0 text with its copyright lines.
  const firebase = row(/^firebase\d/);
  await firebase.locator('summary').click();
  await expect(firebase).toContainText('以下是 Apache-2.0 的標準條文');
  await expect(firebase.locator('pre')).toContainText(/^Copyright \d{4} Google LLC/);

  // Open licence texts wrap inside the sheet instead of widening the page.
  if (testInfo.project.name === 'mobile')
    await page.setViewportSize({ width: 320, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('the settings page links to 開源授權', async ({ page }) => {
  await page.goto('/settings');
  const row = page.locator('main').getByRole('link', { name: /^開源授權/ });
  await expect(row).toHaveAttribute('href', '/licenses');
  await row.click();
  await expect(page).toHaveURL(/\/licenses$/);
  await expect(topbarTitle(page)).toBeVisible();
});

test('the settings dialog closes when 開源授權 is opened from it', async ({ page }) => {
  await page.goto('/privacy');
  const dialog = page.getByRole('dialog', { name: '設定', exact: true });
  const nav = await openNavigation(page);
  // Before hydration 設定 is a plain link to /settings; retry until it opens the dialog.
  await expect(async () => {
    if (!(await nav.isVisible())) await openNavigation(page);
    await nav.getByRole('link', { name: '設定', exact: true }).click({ timeout: 1000 });
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();

  await dialog.getByRole('link', { name: /^開源授權/ }).click();
  await expect(page).toHaveURL(/\/licenses$/);
  await expect(dialog).toHaveCount(0);
  await expect(topbarTitle(page)).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-page-scroll-locked');
});
