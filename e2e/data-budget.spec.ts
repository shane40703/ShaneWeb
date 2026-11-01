import { expect, test, type Page } from '@playwright/test';

/** Each screen downloads what it shows. These fail when a page starts asking for more again. */
function watchRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  return {
    questionData: () => urls.filter((url) => url.includes('/question-data/')),
    pageData: () => urls.filter((url) => url.includes('/_next/data/')),
  };
}

test('考古題討論版 downloads the paper on screen, not the bank', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const requests = watchRequests(page);

  await page.goto('/exams?question=env-114-03');
  await expect(page.getByRole('heading', { name: '第 3 題' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(requests.questionData().map((url) => new URL(url).pathname)).toEqual([
    '/question-data/env/114.json',
  ]);
});

test('every question stays reachable from a subject that was never loaded', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/exams');
  await page.locator('button[data-subject="structure"]').click();

  await expect(page).toHaveURL(/question=structure-114-/);
  await expect(
    page.getByRole('group', { name: '年度' }).getByRole('button', { name: '100 年' }),
  ).toBeEnabled();
});

test('a question page can be read without the discussion editor', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const scripts: string[] = [];
  page.on('response', async (response) => {
    if (response.url().endsWith('.js'))
      scripts.push(await response.text().catch(() => ''));
  });

  await page.goto('/exams');
  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(scripts.some((source) => source.includes('ProseMirror'))).toBe(false);
});
