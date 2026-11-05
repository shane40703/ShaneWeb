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
    // The way up to its paper.
    expect(html).toContain('href="/exams/law/114"');
    expect(html).toMatch(
      /<a [^>]*href="\/exams\/law\/114"[^>]*>(?:(?!<\/a>)[\s\S])*返回 114 年營建法規與實務考古題<\/a>/,
    );
  });

  test('no directory address carries a question', async ({ request }) => {
    // The paper these addresses lead to, as the site serves it to the browser.
    const paper: { id: string; text: string }[] = await (
      await request.get('/question-data/law/114.json')
    ).json();
    const stems = paper
      .map(({ text }) => text)
      .filter((text) => text.length >= 12)
      .map((text) => text.slice(0, 20));
    expect(stems.length).toBeGreaterThan(70);
    // As the text would appear in the page, in the markup and in the page's data.
    const forms = (stem: string) => [
      stem,
      stem.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      JSON.stringify(stem).slice(1, -1),
    ];
    const carried = (html: string) =>
      stems.filter((stem) => forms(stem).some((form) => html.includes(form)));

    // The check finds a question where one is.
    const third = paper.find(({ id }) => id === 'law-114-03')!.text.slice(0, 20);
    expect(carried(await (await request.get('/exams/law/114/3')).text())).toContain(
      third,
    );

    const pages: Record<string, string> = {};
    for (const path of ['/exams', '/exams/law', '/exams/law/114']) {
      const response = await request.get(path);
      expect(response.ok(), path).toBe(true);
      pages[path] = await response.text();
      expect(carried(pages[path]), path).toEqual([]);
      expect(pages[path], path).toContain('"initialQuestion":null');
    }

    expect(pages['/exams']).toContain('href="/exams/law"');
    expect(pages['/exams']).toMatch(/name="description" content="[^"]+"/);
    expect(pages['/exams/law']).toContain('href="/exams/law/100"');
    expect(pages['/exams/law']).toContain('返回考古題討論版');
    expect(pages['/exams/law/114']).toContain('href="/exams/law/114/1"');
    expect(pages['/exams/law/114']).toContain('href="/exams/law/114/80"');
    expect(pages['/exams/law/114']).toContain('建築技術規則');
    expect(pages['/exams/law/114']).toContain('href="/exams/law"');
    expect(pages['/exams/law/114']).toMatch(
      /name="description" content="[^"]*考得最多[^"]*"/,
    );
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

test('a paper address lists its questions and a row opens one', async ({ page }) => {
  await page.goto('/exams/law/112');

  await expect(page).toHaveTitle('112 年營建法規與實務考古題｜建築師考試');
  await expect(page.locator('header h1')).toHaveText('112 年營建法規與實務考古題');
  await expect(page.getByRole('link', { name: /^第 80 題( |$)/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '第 1 題' })).toHaveCount(0);

  await page.getByRole('link', { name: /^第 1 題( |$)/ }).click();
  await expect(page).toHaveURL(/\/exams\/law\/112\/1$/);
  await expect(page).toHaveTitle('112 年營建法規與實務考古題第 1 題｜建築師考試');
  await expect(page.getByRole('heading', { name: '第 1 題' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/exams\/law\/112$/);
  await expect(page.locator('header h1')).toHaveText('112 年營建法規與實務考古題');
});

test('Back from a question returns to its row on the paper list', async ({ page }) => {
  const scrollY = () => page.evaluate(() => window.scrollY);
  await page.goto('/exams/law/114');

  // Twice: the second trip starts from an entry that Back has already returned to.
  for (const number of [60, 79]) {
    const row = page.getByRole('link', { name: new RegExp(`^第 ${number} 題( |$)`) });
    await row.evaluate((link) =>
      link.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const top = await scrollY();
    expect(top).toBeGreaterThan(200);

    await row.click();
    await expect(page).toHaveURL(new RegExp(`/exams/law/114/${number}$`));
    await expect(page.getByRole('heading', { name: `第 ${number} 題` })).toBeVisible();
    // A new level starts at the top.
    await expect.poll(scrollY).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/exams\/law\/114$/);
    await expect(row).toBeVisible();
    // There at once, not by an animation from the question's place, and it stays there.
    expect(Math.abs((await scrollY()) - top)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(800);
    expect(Math.abs((await scrollY()) - top)).toBeLessThanOrEqual(1);
    await expect(row).toBeInViewport();
  }
});

test('a campaign link to the home page leaves a clean address and the way back', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: '聯絡方式' })).toBeVisible();
  const entries = await page.evaluate(() => history.length);

  await page.evaluate(() => {
    window.location.href =
      '/?utm_source=threads&utm_medium=social&utm_campaign=launch&utm_content=comment';
  });
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);

  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
  await page.goBack();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.goForward();
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
});

test('every other page keeps its address and its choices', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/exams/law/114/3?tab=discussion&utm_source=threads');
  await expect(page.getByRole('tab', { name: /討論區/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page).toHaveURL(
    /\/exams\/law\/114\/3\?tab=discussion&utm_source=threads$/,
  );

  await page.goto('/practice/quiz?utm_source=threads');
  const setup = page.getByRole('region', { name: '每日抽題練習設定' });
  const subject = setup.getByRole('radio', { name: /營建法規與實務/ });
  await expect(async () => {
    await subject.click({ timeout: 1000 });
    await expect(subject).toBeChecked({ timeout: 1000 });
  }).toPass();
  await page.waitForTimeout(500);

  await expect(subject).toBeChecked();
  await expect(page).toHaveURL(/\/practice\/quiz\?utm_source=threads$/);
});
