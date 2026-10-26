import { expect, test, type Page } from '@playwright/test';

async function expectCompactTopbarHeading(page: Page, name: string) {
  const pageHeading = page.getByRole('heading', { level: 1 });

  await expect(pageHeading).toHaveCount(1);
  await expect(pageHeading).toHaveText(name);
  await expect(pageHeading).toHaveCSS('font-size', '16px');
  await expect(page.locator('header h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveCount(0);
}

test('question content is present in build-time static HTML', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  const [examsResponse, notesResponse] = await Promise.all([
    request.get('/exams'),
    request.get('/notes'),
  ]);
  expect(examsResponse.ok()).toBe(true);
  expect(notesResponse.ok()).toBe(true);

  const [examsHtml, notesHtml] = await Promise.all([
    examsResponse.text(),
    notesResponse.text(),
  ]);
  const prompt = '依建築法規定，下列敘述何者錯誤？';
  expect(examsHtml).toContain(prompt);
  expect(examsHtml).toContain(
    '建築基地，為供建築物本身所占之地面及其所應留設之法定空地',
  );
  expect(notesHtml).toContain(prompt);
});

test('question-bank failures never expose an unrelated editable question', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.route('**/question-data/**', async (route) => {
    await route.abort();
  });

  await page.goto('/exams?question=env-114-01');
  await expect(
    page.getByRole('heading', { name: '題庫載入失敗' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '匿名送出' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '標記為難題' }),
  ).toHaveCount(0);

  await page.goto('/notes?question=env-114-01');
  await expect(
    page.getByRole('heading', { name: '題庫載入失敗' }),
  ).toBeVisible();
  await expect(page.getByLabel('我的筆記')).toHaveCount(0);
});

test('one failed subject does not hide difficult questions from other subjects', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.addInitScript(() => {
    localStorage.setItem(
      'shaneweb:state',
      JSON.stringify({
        answers: {},
        difficultQuestionIds: ['law-114-01', 'env-114-01'],
        attempts: [],
        notes: {},
        noteImages: {},
        discussionPosts: [],
        likedDiscussionPostIds: [],
      }),
    );
  });
  await page.route('**/question-data/env/**', async (route) => {
    await route.abort();
  });

  await page.goto('/difficult');

  await expect(
    page.getByRole('heading', { name: '建築法規與實務' }),
  ).toBeVisible();
  await expect(
    page.getByText(/依建築法規定，下列敘述何者錯誤/).first(),
  ).toBeVisible();
  await expect(
    page.getByText('建築環境控制的難題載入失敗'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '重新載入' })).toBeVisible();
});

test('notes save and reload from local storage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/notes?question=law-114-01');
  await expect(page.getByRole('group', { name: '科目' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: '年度' }).getByRole('button', { name: '114 年' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('group', { name: '題號' }).getByRole('button', { name: '第 1 題' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const noteNavigator = page.getByRole('complementary', {
    name: '筆記題號導覽',
  });
  await expect(noteNavigator).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('group', { name: '題號' })
        .getByRole('button', { name: '第 1 題' })
        .evaluate((element) => getComputedStyle(element).width),
    )
    .toBe('38px');
  const [editorBounds, navigatorBounds] = await Promise.all([
    page.getByLabel('我的筆記').boundingBox(),
    noteNavigator.boundingBox(),
  ]);
  expect(editorBounds).not.toBeNull();
  expect(navigatorBounds).not.toBeNull();
  expect(navigatorBounds!.x).toBeGreaterThan(editorBounds!.x);
  await page.getByLabel('我的筆記').fill('法定空地分割辦法由中央主管建築機關定之。');
  await page.getByLabel('上傳筆記圖片').setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: '儲存筆記' }).click();
  await expect(
    noteNavigator.getByRole('button', { name: '第 1 題（有筆記）' }),
  ).toHaveAttribute('data-noted', 'true');
  await page.reload();
  // Saved notes reopen in the formatted reading view, not the textarea.
  await expect(page.getByRole('region', { name: '已儲存筆記內容' })).toContainText(
    '法定空地分割辦法由中央主管建築機關定之。',
  );
  await expect(page.getByRole('img', { name: 'note.png' })).toBeVisible();
  await expect(
    page
      .getByRole('complementary', { name: '筆記題號導覽' })
      .getByRole('button', { name: '第 1 題（有筆記）' }),
  ).toHaveAttribute('data-noted', 'true');
  await page.getByRole('button', { name: '編輯筆記', exact: true }).click();
  await expect(page.getByLabel('我的筆記')).toHaveText('法定空地分割辦法由中央主管建築機關定之。');
});

test('all retained routes support direct visits and the removed old pages return 404', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const routes = [
    { path: '/', title: '首頁' },
    { path: '/practice', title: '每日練習' },
    { path: '/practice/quiz', title: '每日抽題練習' },
    { path: '/practice/law-cloze', title: '法規克漏字' },
    { path: '/practice/mock-exam', title: '歷屆試題模擬考' },
    { path: '/exams', title: '考古題討論版' },
    { path: '/resources', title: '歷屆試題資料集成' },
    { path: '/resources/analysis', title: '考題分析' },
    { path: '/resources/memory-gallery', title: '速記圖庫' },
    { path: '/resources/laws', title: '法規資料庫' },
    { path: '/notes', title: '使用者筆記' },
    { path: '/difficult', title: '難題標記' },
    { path: '/wrong', title: '常錯題目' },
    { path: '/history', title: '已作答紀錄' },
    { path: '/settings', title: '設定' },
    { path: '/appearance', title: '設定' },
  ] as const;

  for (const route of routes) {
    const response = await page.goto(route.path);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('main').first()).toBeVisible();
    await expectCompactTopbarHeading(page, route.title);
    await page.reload();
    await expect(page.locator('main').first()).toBeVisible();
    await expectCompactTopbarHeading(page, route.title);
  }

  // The old versions are gone without redirects.
  for (const path of [
    '/daily',
    '/papers?subject=law',
    '/random',
    '/law-cloze',
    '/analysis',
    '/memory-gallery',
    '/laws',
    '/community',
    '/questions/law/114/01',
    '/quiz',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test('custom theme colors apply to their mode and survive a reload', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/appearance');
  await page.getByRole('radio', { name: '深色模式' }).locator('..').click();
  await page.getByText('進階設定', { exact: true }).click();
  await page.getByLabel('頁面背景十六進位色碼').fill('#000000');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '套用此模式' }).click();
  await page.getByRole('button', { name: '切換為深色模式' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--bg').trim(),
      ),
    )
    .toBe('#000000');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(
          localStorage.getItem('shaneweb:theme-colors') ?? '{}',
        );
        return stored.palettes?.dark?.background;
      }),
    )
    .toBe('#000000');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--bg').trim(),
      ),
    )
    .toBe('#000000');
});

test('official theme presets preview, apply, and survive a reload', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/appearance');
  await page.getByRole('radio', { name: '深色模式' }).locator('..').click();

  const defaultPreset = page.getByRole('radio', { name: /墨紙方格/ });
  const carbonPreset = page.getByRole('radio', { name: /現代炭黑/ });
  await defaultPreset.focus();
  await page.keyboard.press('ArrowRight');

  await expect(carbonPreset).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect
    .poll(() =>
      page
        .getByRole('region', { name: '深色模式配色預覽' })
        .evaluate((element) =>
          element.style.getPropertyValue('--bg').trim(),
        ),
    )
    .toBe('#181818');
  expect(
    await page.evaluate(() => {
      const stored = JSON.parse(
        localStorage.getItem('shaneweb:theme-colors') ?? '{}',
      );
      return stored.palettes?.dark?.background ?? null;
    }),
  ).toBeNull();

  await page.getByRole('button', { name: '套用此模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(
          localStorage.getItem('shaneweb:theme-colors') ?? '{}',
        );
        return stored.palettes?.dark?.background;
      }),
    )
    .toBe('#181818');

  await page.getByRole('button', { name: '切換為深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--bg').trim(),
      ),
    )
    .toBe('#181818');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--bg').trim(),
      ),
    )
    .toBe('#181818');
});

