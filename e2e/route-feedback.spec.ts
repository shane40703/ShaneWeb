import { expect, test } from '@playwright/test';

test('the sidebar answers a click before the page arrives', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/practice');
  await page.waitForLoadState('networkidle');
  await page.route('**/_next/data/**/exams.json*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  const sidebar = page.getByRole('navigation', { name: '主要功能' });
  const placeholder = page.getByRole('status', { name: '正在開啟頁面' });
  await sidebar.getByRole('link', { name: '考古題討論版' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: '考古題討論版' }),
  ).toBeVisible();
  await expect(sidebar.getByRole('link', { name: '考古題討論版' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page).toHaveURL(/\/practice$/);
  // It waits a beat at opacity 0, so a page that arrives quickly never shows it.
  await expect(placeholder).toHaveCSS('opacity', '1');

  await expect(page).toHaveURL(/\/exams$/);
  await expect(placeholder).toHaveCount(0);
  // 考古題討論版 lists its subjects.
  await expect(
    page.getByRole('link', { name: '營建法規與實務', exact: true }),
  ).toBeVisible();
});

test('下一題 keeps the keyboard in place while the next paper downloads', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/question-data/law/113.json*', async (route) => {
    await held;
    await route.continue();
  });

  await page.goto('/exams?question=law-114-80');
  await expect(page.getByRole('heading', { name: '第 80 題' })).toBeVisible();

  const next = page.locator('footer').getByRole('button', { name: '下一題' });
  await next.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/exams\/law\/113\/1$/);
  await expect(next).toBeFocused();
  await expect(page.getByText('正在載入題目內容…')).toBeVisible();

  release();
  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();
  await expect(next).toBeFocused();
});
