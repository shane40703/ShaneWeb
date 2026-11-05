import { expect, test, type Page } from '@playwright/test';

/** Each screen downloads what it shows. These fail when a page starts asking for more again. */
function watchRequests(page: Page) {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  return {
    questionData: () => urls.filter((url) => url.includes('/question-data/')),
    /** The papers' own files; a law question brings its 類似題目 rows in a file of its own. */
    papers: () =>
      urls
        .map((url) => new URL(url).pathname)
        .filter((path) => /^\/question-data\/[a-z]+\/\d{3}\.json$/.test(path)),
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
  const requests = watchRequests(page);
  const files = () => requests.questionData().map((url) => new URL(url).pathname);

  await page.goto('/exams');
  await page.waitForLoadState('networkidle');
  await page.locator('a[data-subject="structure"]').click();

  await expect(page).toHaveURL(/\/exams\/structure$/);
  await expect(page.locator('header h1')).toHaveText('建築結構考古題');
  expect(files()).toEqual([]);

  await page.getByRole('link', { name: '100 年', exact: true }).click();
  await expect(page).toHaveURL(/\/exams\/structure\/100$/);
  // The paper's own file, for its topics and so that its questions open at once.
  await expect(page.getByRole('link', { name: /^申論第 1 題 \S/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(files()).toEqual(['/question-data/structure/100.json']);

  await page.getByRole('link', { name: /^申論第 1 題( |$)/ }).click();
  await expect(page).toHaveURL(/\/exams\/structure\/100\/written-1$/);
  await expect(page.getByRole('heading', { name: '申論第 1 題' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Only the paper before it, which 上一題 crosses into from here, comes on top.
  expect(files()).toEqual([
    '/question-data/structure/100.json',
    '/question-data/structure/101.json',
  ]);
});

test('考古題討論版 overviews download only the paper they list', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const requests = watchRequests(page);
  const files = () => requests.questionData().map((url) => new URL(url).pathname);
  // A move under /exams stays on the loaded page. The sidebar still prefetches the pages it
  // links, 考古題討論版's first question among them, and Next marks those as prefetches.
  const fetchedPageData: string[] = [];
  page.on('request', (request) => {
    if (
      request.url().includes('/_next/data/') &&
      request.headers().purpose !== 'prefetch'
    )
      fetchedPageData.push(request.url());
  });
  const examsPageData = () =>
    fetchedPageData.filter((url) => new URL(url).pathname.includes('/exams/'));

  await page.goto('/exams');
  await expect(
    page.getByRole('link', { name: '營建法規與實務', exact: true }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.goto('/exams/law');
  await expect(page.getByRole('link', { name: '114 年', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(files()).toEqual([]);

  await page.goto('/exams/law/114');
  await expect(page.getByRole('link', { name: /^第 1 題( |$)/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(files()).toEqual(['/question-data/law/114.json']);

  // Every step of the walk stays on this loaded page.
  await page.evaluate(() => {
    (window as Window & { walked?: boolean }).walked = true;
  });
  await page.getByRole('link', { name: /^第 1 題( |$)/ }).click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/1$/);
  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();
  await page.getByRole('link', { name: '返回 114 年營建法規與實務考古題' }).click();
  await expect(page).toHaveURL(/\/exams\/law\/114$/);
  await page.getByRole('link', { name: /^第 2 題( |$)/ }).click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/2$/);
  await expect(page.getByRole('heading', { name: '第 2 題' })).toBeVisible();
  // Back through the walk to the page the reader arrived on, without loading it again.
  await page.goBack();
  await expect(page).toHaveURL(/\/exams\/law\/114$/);
  await expect(page.getByRole('link', { name: /^第 2 題( |$)/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/exams\/law\/114\/1$/);
  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/exams\/law\/114$/);
  await expect(page.getByRole('heading', { name: '第 1 題' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^第 1 題( |$)/ })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(
    await page.evaluate(() => (window as Window & { walked?: boolean }).walked),
  ).toBe(true);
  expect(requests.papers()).toEqual(['/question-data/law/114.json']);
  expect(examsPageData()).toEqual([]);
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
  const editorLoaded = () => scripts.some((source) => source.includes('ProseMirror'));

  await page.goto('/exams/law/114/1');
  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(editorLoaded()).toBe(false);

  await page.goto('/exams/law/114');
  await expect(page.getByRole('link', { name: /^第 1 題( |$)/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(editorLoaded()).toBe(false);
});
