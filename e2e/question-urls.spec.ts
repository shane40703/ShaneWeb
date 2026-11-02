import { expect, test } from '@playwright/test';

test.describe('what a search engine reads', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop'));

  test('a question page carries its own text, title and address before any script runs', async ({
    request,
  }) => {
    const html = await (await request.get('/exams/law/114/3')).text();

    expect(html).toMatch(
      /<title[^>]*>114 年營建法規與實務考古題第 3 題｜建築師考試<\/title>/,
    );
    expect(html).toContain(
      'rel="canonical" href="https://exam-tw.vercel.app/exams/law/114/3"',
    );
    expect(html).toContain('公有建築物應由下列何者');
    expect(html).toContain(
      'name="description" content="114 年建築師考試營建法規與實務第 3 題：',
    );
    expect(html).toContain('href="/exams/law/114/4"');
    expect(html).toContain('href="/exams/env"');
    expect(html).toContain('href="/exams/law/113"');
  });

  test('robots.txt points at a sitemap listing every question, and no personal page', async ({
    request,
  }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Sitemap: https://exam-tw.vercel.app/sitemap.xml');
    expect(robots).toContain('Disallow: /notes');
    expect(robots).not.toMatch(/Disallow: \/exams/);

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://exam-tw.vercel.app/exams/law/114/3</loc>');
    expect(sitemap).toContain(
      '<loc>https://exam-tw.vercel.app/exams/env/100/written-1</loc>',
    );
    expect(sitemap).toContain(
      '<loc>https://exam-tw.vercel.app/exams/structure/100</loc>',
    );
    expect(sitemap).not.toContain('/notes');
  });

  test('an address that holds no question is not found', async ({ request }) => {
    expect((await request.get('/exams/law/114/99')).status()).toBe(404);
  });
});

test('an old question link lands on the question’s own address', async ({ page }) => {
  await page.goto('/exams?question=law-114-03&tab=discussion');

  await expect(page).toHaveURL(/\/exams\/law\/114\/3\?tab=discussion$/);
  await expect(page.getByRole('tab', { name: /討論區/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the title follows the question without leaving the page', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/exams/law/114/3');
  await expect(page.getByRole('heading', { name: '第 3 題' })).toBeVisible();

  const tile = page
    .getByRole('group', { name: '題號' })
    .getByRole('link', { name: '第 4 題' });
  await expect(async () => {
    await tile.click({ timeout: 1000 });
    await expect(page).toHaveURL(/\/exams\/law\/114\/4$/, { timeout: 1000 });
  }).toPass();
  await expect(page).toHaveTitle('114 年營建法規與實務考古題第 4 題｜建築師考試');
  await expect(page.getByRole('heading', { name: '第 4 題' })).toBeVisible();
});

test('a paper address opens on its first question', async ({ page }) => {
  await page.goto('/exams/law/112');

  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();
  await expect(page).toHaveTitle('112 年營建法規與實務考古題｜建築師考試');
});
