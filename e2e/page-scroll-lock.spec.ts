import { expect, test, type Page, type TestInfo } from '@playwright/test';

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== 'mobile', 'the drawer is the phone layout');
}

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

const pageOverflow = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).overflowY);

test('settings opened from the phone menu holds the page, then lets it scroll again', async ({
  page,
}, testInfo) => {
  mobileOnly(testInfo);
  await page.goto('/');
  const nav = await openNavigation(page);
  await nav.getByRole('link', { name: '設定', exact: true }).tap();
  const settings = page.getByRole('dialog', { name: '設定', exact: true });
  await expect(settings).toBeVisible();

  // The drawer gives its own lock back on a timer after closing, which the sheet must outlast.
  await expect(
    page.getByRole('dialog', { name: '主要功能', includeHidden: true }),
  ).toHaveCount(0);
  expect(await pageOverflow(page)).toBe('hidden');

  await settings.locator('header').getByRole('button', { name: '關閉設定' }).tap();
  await expect(settings).toBeHidden();
  expect(await pageOverflow(page)).toBe('visible');
});
