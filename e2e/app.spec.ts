import { expect, test } from '@playwright/test';

test('paper flow, timer, difficult marker, result, and history persist', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '選擇練習科目' })).toBeVisible();
  await expect(page.locator('main h2')).toHaveCount(4);
  await page.getByRole('link', { name: /建築法規與實務/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=law/);
  const subjectPicker = page.getByRole('group', { name: '科目' });
  await expect(subjectPicker.getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('combobox', { name: '科目' })).toHaveCount(0);
  await subjectPicker.getByRole('button', { name: /建築環境控制/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=env/);
  await expect(subjectPicker.getByRole('button', { name: /建築環境控制/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await subjectPicker.getByRole('button', { name: /建築法規與實務/ }).click();
  await expect(page).toHaveURL(/\/papers\?subject=law/);
  await expect(page.locator('article')).toHaveCount(13);
  await expect(page.locator('main')).not.toContainText('民國');
  await expect(page.locator('main')).not.toContainText('住宅居室採光有效面積');

  await page.getByRole('button', { name: /開始作答/ }).first().click();
  await expect(page).toHaveURL(/\/questions\/law\/114\/01/);
  await expect(page.getByText('作答時間')).toBeVisible();
  await expect(page.getByText(/00:00:0\d/)).toBeVisible();

  await page.getByRole('button', { name: '標記為難題' }).click();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toBeVisible();
  await page.getByText('建築基地，為供建築物本身所占之地面及其所應留設之法定空地', { exact: true }).click();
  await page.getByRole('button', { name: '送出答案' }).click();

  await expect(page.getByText('答案不正確', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('shaneweb:v4')))
    .toContain('law-114-01');

  await page.goto('/difficult');
  await expect(page.getByText(/依建築法規定，下列敘述何者錯誤/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('0%', { exact: true })).toBeVisible();
  await expect(page.getByText(/^答錯/)).toBeVisible();
});

test('static question paths navigate between questions and keep answer state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/questions/construction/114/01');
  const navigator = page.getByRole('complementary', { name: '題號導覽' });
  await expect(navigator).toBeVisible();
  await expect(navigator.getByRole('link')).toHaveCount(2);
  await expect(navigator.getByRole('link', { name: '前往第 1 題' })).toHaveAttribute('aria-current', 'step');

  await page.getByText('(3)＞(2)＞(1)', { exact: true }).click();
  await page.getByRole('button', { name: '送出答案' }).click();
  await expect(page.getByText('答對了', { exact: true })).toBeVisible();

  await navigator.getByRole('link', { name: '前往第 49 題' }).click();
  await expect(page).toHaveURL(/\/questions\/construction\/114\/49/);
  await expect(page.getByText(/何者可能具有最佳的防水效果/)).toBeVisible();
  await expect(navigator.getByRole('link', { name: '前往第 49 題' })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '送出答案' })).toBeDisabled();
  await expect(page.getByText('答對了', { exact: true })).toHaveCount(0);

  await expect(navigator.getByRole('link', { name: '前往第 1 題' })).toHaveAttribute('data-answered', 'true');

  await page.getByText('圖 A', { exact: true }).click();
  await navigator.getByRole('link', { name: '前往第 1 題' }).click();
  await expect(page.getByText('答對了', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);

  await navigator.getByRole('link', { name: '前往第 49 題' }).click();
  await expect(page.getByText('圖 A', { exact: true }).locator('..').getByRole('radio')).toBeChecked();
  await expect(page.getByRole('button', { name: '送出答案' })).toBeEnabled();
});

test('question content is present in build-time static HTML', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const response = await request.get('/questions/law/114/01');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('依建築法規定，下列敘述何者錯誤？');
  expect(html).toContain('建築基地，為供建築物本身所占之地面及其所應留設之法定空地');
});

test('static question files render ordered images and text-only options', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/questions/construction/114/01');
  const firstPromptText = page.getByText(/依據下圖中之衝擊韌性試片結果圖/);
  await expect(firstPromptText).toBeVisible();
  const firstPrompt = firstPromptText.locator('..');
  await expect(firstPrompt.locator(':scope > *')).toHaveCount(2);
  expect(await firstPrompt.locator(':scope > *').evaluateAll((nodes) => nodes.map((node) => node.tagName))).toEqual([
    'P',
    'FIGURE',
  ]);
  await expect(page.getByRole('img', { name: '標示為（1）、（2）、（3）的三個衝擊韌性試片斷口照片' })).toBeVisible();
  const options = page.getByRole('radiogroup', { name: '請選擇答案' });
  await expect(options.locator('img')).toHaveCount(0);
  await expect(options.getByText('(3)＞(2)＞(1)', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page.getByText(/何者可能具有最佳的防水效果/)).toBeVisible();
  await expect(page.getByRole('img', { name: '圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖' })).toBeVisible();
  await expect(options.locator('img')).toHaveCount(0);
  await expect(options.getByText('圖 A', { exact: true })).toBeVisible();
  await expect(options.getByText('圖 D', { exact: true })).toBeVisible();
});

test('official corrected answer accepts every published answer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/questions/construction/114/49');
  await page.getByText('圖 B', { exact: true }).click();
  await page.getByRole('button', { name: '送出答案' }).click();
  await expect(page.getByText('答對了', { exact: true })).toBeVisible();
});

test('analysis only shows exam-content distribution', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/analysis?subject=law&year=all');
  await expect(page.getByRole('heading', { name: '考題分析' })).toBeVisible();
  await expect(page.getByText('總題數 84 題')).toBeVisible();
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
  await expect(page).toHaveURL(/question=law-114-02/);
  await page.getByRole('button', { name: '上一題' }).click();
  await expect(page).toHaveURL(/question=law-114-01/);

  const content = '先逐項比對建築法中的法定空地定義與主管機關權限。';
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
  await page.getByLabel('我的筆記').fill('法定空地分割辦法由中央主管建築機關定之。');
  await page.getByRole('button', { name: '儲存筆記' }).click();
  await page.reload();
  await expect(page.getByLabel('我的筆記')).toHaveValue('法定空地分割辦法由中央主管建築機關定之。');
});

test('all retained routes support direct visits and removed routes return 404', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const routes = [
    '/',
    '/papers?subject=law',
    '/questions/law/114/01',
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

  const randomResponse = await page.goto('/random');
  expect(randomResponse?.status()).toBe(404);
  const quizResponse = await page.goto('/quiz');
  expect(quizResponse?.status()).toBe(404);
  const missingQuestionResponse = await page.goto('/questions/law/114/99');
  expect(missingQuestionResponse?.status()).toBe(404);
});

test('mobile drawer no longer contains random quiz and navigates to papers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/');
  await page.getByRole('button', { name: '開啟選單' }).click();
  await expect(page.getByRole('link', { name: '隨機出題' })).toHaveCount(0);
  await page.getByRole('link', { name: '歷屆試題' }).click();
  await expect(page).toHaveURL(/\/papers$/);
  await expect(page.getByRole('heading', { name: '歷屆試題' })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test('question images remain responsive on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/questions/construction/114/49');
  await expect(page.getByRole('img', { name: '圖 A 至圖 D 四種屋頂設備基礎防水收頭細部剖面圖' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '請選擇答案' }).locator('img')).toHaveCount(0);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
