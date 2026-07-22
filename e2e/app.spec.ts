import { expect, test } from '@playwright/test';

test('paper flow, timer, difficult marker, result, and history persist', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '選擇練習科目' })).toBeVisible();
  await expect(page.locator('main h2')).toHaveCount(4);
  await page.getByRole('link', { name: /建築法規與實務/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=law/);
  await expect(page.locator('article')).toHaveCount(13);
  await expect(page.locator('main')).not.toContainText('民國');
  await expect(page.locator('main')).not.toContainText('住宅居室採光有效面積');

  await page.getByRole('link', { name: /開始作答/ }).first().click();
  await expect(page).toHaveURL(/\/quiz\?subject=law&year=114/);
  await expect(page.getByText('作答時間')).toBeVisible();
  await expect(page.getByText(/00:00:0\d/)).toBeVisible();

  await page.getByRole('button', { name: '標記為難題' }).click();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toBeVisible();
  await page.getByText('1/5', { exact: true }).click();
  await page.getByRole('button', { name: '交卷' }).click();

  await expect(page.getByRole('heading', { name: '本次作答結果' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '答錯題目' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('shaneweb:v3')))
    .toContain('law-114-01');

  await page.goto('/difficult');
  await expect(page.getByText(/住宅居室採光有效面積/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await expect(page.getByText('答錯')).toBeVisible();
});

test('question navigator jumps between questions and keeps answer state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/quiz?mode=random&questions=law-114-01,env-114-01,construction-114-01');
  const navigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(navigator).toBeVisible();
  await expect(navigator.getByRole('button')).toHaveCount(3);
  await expect(navigator.getByRole('button', { name: '前往第 1 題' })).toHaveAttribute('aria-current', 'step');

  await navigator.getByRole('button', { name: '前往第 2 題' }).click();
  await expect(page.getByRole('heading', { name: /U 值越小/ })).toBeVisible();
  await expect(navigator.getByRole('button', { name: '前往第 2 題' })).toHaveAttribute('aria-current', 'step');

  await page.getByText('隔熱性能越好', { exact: true }).click();
  await expect(navigator.getByRole('button', { name: '前往第 2 題（已作答）' })).toBeVisible();

  await navigator.getByRole('button', { name: '前往第 1 題' }).click();
  await expect(page.getByRole('heading', { name: /住宅居室採光有效面積/ })).toBeVisible();
});

test('analysis only shows exam-content distribution', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/analysis?subject=law&year=all');
  await expect(page.getByRole('heading', { name: '考題分析' })).toBeVisible();
  await expect(page.getByText('總題數 5 題')).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('主要分類占比')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('個人答對率');
  await expect(page.locator('main')).not.toContainText('弱點分析');

  await page.getByRole('combobox', { name: '科目' }).click();
  await page.getByRole('option', { name: '建築環境控制' }).click();
  await expect(page).toHaveURL(/subject=env/);
});

test('community selectors and local anonymous interactions work', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/community?question=law-114-01');
  await expect(page.getByRole('combobox', { name: '科目' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '年份' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '題號' })).toBeVisible();
  await expect(page.getByText('正確答案')).toBeVisible();

  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page).toHaveURL(/question=law-113-01/);
  await page.getByRole('button', { name: '上一題' }).click();
  await expect(page).toHaveURL(/question=law-114-01/);

  const content = '先確認題目限定的是居室採光，再比對八分之一。';
  await page.getByLabel('內容').fill(content);
  await page.getByRole('button', { name: '匿名送出' }).click();
  const post = page.locator('article').filter({ hasText: content });
  await expect(post).toBeVisible();
  await post.getByRole('button', { name: /讚 0/ }).click();
  await expect(post.getByRole('button', { name: /讚 1/ })).toBeVisible();
  await post.getByLabel('回覆這則內容').fill('這個記法很清楚。');
  await post.getByRole('button', { name: '回覆' }).click();
  await expect(post.getByText('這個記法很清楚。')).toBeVisible();
  await post.getByRole('button', { name: '檢舉' }).click();
  await expect(post.getByRole('button', { name: '已檢舉' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(content)).toBeVisible();
});

test('notes save and reload from local storage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/notes?question=law-114-01');
  await page.getByLabel('我的筆記').fill('採光有效面積：樓地板面積的八分之一。');
  await page.getByRole('button', { name: '儲存筆記' }).click();
  await page.reload();
  await expect(page.getByLabel('我的筆記')).toHaveValue('採光有效面積：樓地板面積的八分之一。');
});

test('all Pages Router routes support direct visits and settings is gone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const routes = [
    '/',
    '/papers?subject=law',
    '/quiz?subject=law&year=114',
    '/random',
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

  const settingsResponse = await page.goto('/settings');
  expect(settingsResponse?.status()).toBe(404);
  await expect(page.getByRole('link', { name: '網頁介面設定' })).toHaveCount(0);
});

test('mobile drawer navigates to the independent random route', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/');
  await page.getByRole('button', { name: '開啟選單' }).click();
  await page.getByRole('link', { name: '隨機出題' }).click();
  await expect(page).toHaveURL(/\/random$/);
  await expect(page.getByRole('heading', { name: '隨機出題' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
