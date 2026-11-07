import { expect, test, type Page } from '@playwright/test';

/** The sidebar's 考古題討論版 returns to the last place the reader saw in it. */

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

/** The place this browser tab keeps; the board writes it once it has hydrated. */
const remembered = (page: Page) =>
  page.evaluate(() => sessionStorage.getItem('shaneweb:exams-place'));

async function openExamsFromSidebar(page: Page) {
  await (
    await openNavigation(page)
  )
    .getByRole('link', { name: '考古題討論版', exact: true })
    .click();
}

/** Leaves for 每日練習 and comes back by the sidebar. */
async function leaveAndReturn(page: Page) {
  await (
    await openNavigation(page)
  )
    .getByRole('link', { name: '每日練習', exact: true })
    .click();
  await expect(page).toHaveURL(/\/practice$/);
  // The phone drawer closes first; opening it again while it animates out finds the old one.
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
    0,
  );
  await openExamsFromSidebar(page);
}

/** Another page's sidebar links /exams, which a click before hydration would load. */
async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test('returns to the last question and its tab', async ({ page }) => {
  await page.goto('/exams/env/112/written-2?tab=discussion');
  await expect
    .poll(() => remembered(page))
    .toBe('/exams/env/112/written-2?tab=discussion');

  await leaveAndReturn(page);
  await expect(page).toHaveURL(/\/exams\/env\/112\/written-2\?tab=discussion$/);
  await expect(page.getByRole('tab', { name: /討論區/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: /^題目$/ }).click();
  await expect(page.getByRole('heading', { name: '申論第 2 題' })).toBeVisible();
});

test('an address lands where it says and becomes the place', async ({ page }) => {
  await page.goto('/exams/law/110');
  await expect.poll(() => remembered(page)).toBe('/exams/law/110');

  await leaveAndReturn(page);
  await expect(page).toHaveURL(/\/exams\/law\/110$/);
  await expect(page.locator('header h1')).toHaveText('110 年營建法規與實務考古題');
});

test('inside 考古題討論版 the sidebar stays on the page', async ({ page }) => {
  await page.goto('/exams/law/114/30');
  await expect.poll(() => remembered(page)).toBe('/exams/law/114/30');
  const entries = await page.evaluate(() => history.length);
  const fetched: string[] = [];
  page.on('request', (request) => {
    if (
      request.url().includes('/_next/data/') &&
      request.headers().purpose !== 'prefetch'
    )
      fetched.push(request.url());
  });

  await openExamsFromSidebar(page);
  // The phone drawer closes, and nothing else happens.
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
    0,
  );
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/exams\/law\/114\/30$/);
  await expect(page.getByRole('heading', { name: '第 30 題' })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(entries);
  expect(fetched).toEqual([]);
});

test('each browser tab keeps its own place, and a new tab starts from the latest', async ({
  page,
  context,
}) => {
  await page.goto('/exams/law/114/7');
  await expect.poll(() => remembered(page)).toBe('/exams/law/114/7');
  const other = await context.newPage();
  await other.goto('/exams/law/108/12');
  await expect.poll(() => remembered(other)).toBe('/exams/law/108/12');

  // Before the first tab comes back to its place, which then becomes the latest again.
  const fresh = await context.newPage();
  await gotoReady(fresh, '/practice');
  await openExamsFromSidebar(fresh);
  await expect(fresh).toHaveURL(/\/exams\/law\/108\/12$/);

  await page.bringToFront();
  await leaveAndReturn(page);
  await expect(page).toHaveURL(/\/exams\/law\/114\/7$/);
});

test('a place that no longer exists costs one 404, then the start', async ({ page }) => {
  await gotoReady(page, '/practice');
  // As a later build would leave it: a question the bank no longer has.
  await page.evaluate(() =>
    localStorage.setItem('shaneweb:exams-place', '/exams/law/114/99'),
  );
  await openExamsFromSidebar(page);
  await expect(page).toHaveTitle('找不到頁面｜建築師考試');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('shaneweb:exams-place')))
    .toBeNull();

  await gotoReady(page, '/practice');
  await openExamsFromSidebar(page);
  await expect(page).toHaveURL(/\/exams\/law\/114\/1$/);
});
