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

test('past exams opens from the navigation and keeps browsing on /exams', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  await nav.getByRole('link', { name: '歷屆試題（新版）', exact: true }).click();
  await expect(page).toHaveURL(/\/exams$/);
  await expect(page).toHaveTitle('歷屆試題（新版）｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('歷屆試題（新版）');
  await expect(
    (await openNavigation(page)).getByRole('link', {
      name: '歷屆試題（新版）',
      exact: true,
    }),
  ).toHaveAttribute('aria-current', 'page');
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
      0,
    );
  }

  const numbers = page.getByRole('group', { name: '題號' });
  await expect(numbers.getByRole('button', { name: '第 1 題' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-02$/);
  await page.getByRole('button', { name: '上一題' }).click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-01$/);
  await page
    .getByRole('group', { name: '年度' })
    .getByRole('button', { name: '112 年' })
    .click();
  await expect(page).toHaveURL(/\/exams\?question=law-112-01$/);
  await page
    .getByRole('group', { name: '科目' })
    .getByRole('button', { name: /建築環境控制/ })
    .click();
  await expect(page).toHaveURL(/\/exams\?question=env-/);

  await page.goto('/exams?question=law-114-01');
  const similar = page.getByRole('region', { name: '類似題目' }).getByRole('link');
  await expect(similar.first()).toBeVisible();
  for (const href of await similar.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  ))
    expect(href).toMatch(/^\/exams\?question=/);
  const target = await similar.first().getAttribute('href');
  await similar.first().click();
  await expect(page).toHaveURL(new RegExp(`${target!.replace('?', '\\?')}$`));

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
});

test('posts on past exams stay with the question', async ({ page }) => {
  const content = `歷屆試題頁的共享投稿 ${test.info().project.name}`;
  await page.goto('/exams?question=law-114-03');
  await page.getByLabel('內容').fill(content);
  await page.getByRole('button', { name: '送出共享投稿' }).click();
  await expect(page.locator('article').filter({ hasText: content })).toBeVisible();

  // Moving within the page keeps the loaded posts, so their absence on the next question counts.
  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-04$/);
  await expect(
    page.getByRole('group', { name: '題號' }).getByRole('button', { name: '第 4 題' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('article').filter({ hasText: content })).toHaveCount(0);
  await page.goto('/exams?question=law-114-03');
  await expect(page.locator('article').filter({ hasText: content })).toBeVisible();
});

test('past exams questions are in the static HTML', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const response = await request.get('/exams');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('依建築法規定，下列敘述何者錯誤？');
});
