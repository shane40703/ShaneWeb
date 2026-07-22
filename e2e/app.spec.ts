import { expect, test } from '@playwright/test';

test('desktop navigation, filters, and persisted answer flow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /把每一次練習/ })).toBeVisible();

  await page.getByRole('link', { name: '歷屆試題' }).click();
  await expect(page).toHaveURL(/\/papers$/);
  await page.getByRole('combobox', { name: '年度' }).click();
  await page.getByRole('option', { name: '民國 114 年' }).click();
  await expect(page).toHaveURL(/year=114/);

  await page.goto('/practice?question=1');
  await page.getByText('1/8', { exact: true }).click();
  await page.getByRole('button', { name: '送出答案' }).click();
  await expect(page.getByRole('status').getByText('回答正確', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('shaneweb:v2')))
    .toContain('"correct":true');

  await page.goto('/papers?status=answered');
  await expect(page.getByText('最近作答：答對')).toBeVisible();
});

test('settings persist after reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/settings');
  await page.getByRole('switch', { name: '深色模式' }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('all public routes support direct visits and reloads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const routes = [
    '/',
    '/papers',
    '/practice',
    '/settings',
    '/analysis',
    '/community',
    '/notes',
    '/difficult',
    '/history',
  ];

  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('main')).toBeVisible();
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
  }
});

test('mobile drawer navigates and closes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/');
  await page.getByRole('button', { name: '開啟選單' }).click();
  await page.getByRole('link', { name: '隨機出題' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('heading', { name: '隨機出題' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
