import { expect, test, type Locator, type Page } from '@playwright/test';

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

const onPhone = () => test.info().project.name === 'mobile';

/** The 題號 tiles: the aside beside the question on desktop; on phones the aside is hidden and
    the compact bar's 題號 button opens them in the 題號導覽 drawer (opened here). */
async function questionTiles(page: Page) {
  if (!onPhone()) return page.getByRole('group', { name: '題號' });
  await page.getByRole('button', { name: '題號', exact: true }).click();
  return page
    .getByRole('dialog', { name: '題號導覽' })
    .getByRole('group', { name: '題號' });
}

/** A tile is a link in the aside, for search engines, and a button in the phone drawer. */
function questionTile(tiles: Locator, name: string) {
  return tiles.getByLabel(name);
}

async function expectCurrentTile(tile: Locator) {
  if (onPhone()) await expect(tile).toHaveAttribute('aria-pressed', 'true');
  else await expect(tile).toHaveAttribute('aria-current', 'step');
}

async function closeQuestionTiles(page: Page) {
  if (!onPhone()) return;
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '題號導覽' })).toHaveCount(0);
}

/** On phones the subject / year selector sits behind a summary button and folds after a choice. */
async function expandSelector(page: Page) {
  if (onPhone()) await page.getByRole('button', { name: '展開科目與年度' }).click();
}

test('copy stays below the choices and aligned right before and after revealing the answer', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { (window as Window & { copiedQuestion?: string }).copiedQuestion = value; },
    } });
  });
  await page.goto('/exams/law/114/1');
  const choices = page.getByRole('radiogroup', { name: '題目選項' });
  const copy = page.getByRole('button', { name: '複製題目' });
  const reveal = page.getByRole('button', { name: '看解答' });
  await expect(choices).toBeVisible();
  const choiceBox = (await choices.boundingBox())!;
  const copyBox = (await copy.boundingBox())!;
  const revealBox = (await reveal.boundingBox())!;
  expect(copyBox.y).toBeGreaterThanOrEqual(choiceBox.y + choiceBox.height);
  expect(copyBox.x).toBeGreaterThan(revealBox.x + revealBox.width);
  await copy.click();
  expect(await page.evaluate(() => (window as Window & { copiedQuestion?: string }).copiedQuestion)).toContain('A.');
  await reveal.click();
  await expect(copy).toBeVisible();
  expect((await copy.boundingBox())!.x).toBeGreaterThan((await page.getByRole('button', { name: '重新作答' }).boundingBox())!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('loading indicators rotate unless reduced motion is requested', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tabler-icon tabler-icon-loader-2');
    svg.setAttribute('data-testid', 'test-loader');
    document.body.appendChild(svg);
  });
  const loader = page.getByTestId('test-loader');
  await expect(loader).toHaveCSS('animation-name', 'loading-indicator-spin');
  await expect(loader).toHaveCSS('animation-iteration-count', 'infinite');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(loader).toHaveCSS('animation-name', 'none');
});

test('past exams opens from the navigation and keeps browsing on /exams', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  await nav.getByRole('link', { name: '考古題討論版', exact: true }).click();
  await expect(page).toHaveURL(/\/exams$/);
  await expect(page).toHaveTitle('考古題討論版｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('考古題討論版');
  await expect(
    (await openNavigation(page)).getByRole('link', {
      name: '考古題討論版',
      exact: true,
    }),
  ).toHaveAttribute('aria-current', 'page');
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
      0,
    );
  }

  const numbers = await questionTiles(page);
  await expectCurrentTile(questionTile(numbers, '第 1 題'));
  await closeQuestionTiles(page);
  // On phones the compact bar above the tabs and the panel footer both offer 上一題／下一題;
  // the first match is the bar's icon button (on desktop the bar is hidden, so the footer's).
  await page.getByRole('button', { name: '下一題' }).first().click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/2$/);
  await page.getByRole('button', { name: '上一題' }).first().click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/1$/);
  await expandSelector(page);
  await page
    .getByRole('group', { name: '年度' })
    .getByRole('link', { name: '112 年' })
    .click();
  await expect(page).toHaveURL(/\/exams\/law\/112$/);
  if (onPhone())
    await expect(page.getByRole('button', { name: '展開科目與年度' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  await expandSelector(page);
  await page
    .getByRole('group', { name: '科目' })
    .getByRole('link', { name: /建築環境控制/ })
    .click();
  await expect(page).toHaveURL(/\/exams\/env$/);

  await page.goto('/exams?question=law-114-01');
  const similar = page.getByRole('region', { name: '類似題目' }).getByRole('link');
  await expect(similar.first()).toBeVisible();
  for (const href of await similar.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  ))
    expect(href).toMatch(/^\/exams\/law\/\d{3}\/\d+$/);
  const target = await similar.first().getAttribute('href');
  await similar.first().click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
});

test('the compact bar scrolls with the page and the footer returns to it', async ({
  page,
}) => {
  test.skip(!onPhone());
  await page.goto('/exams?question=law-114-01');
  const position = page.getByText('1 / 80', { exact: true });
  await expect(position).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await expect(position).not.toBeInViewport();

  // The footer can render before hydration, so retry until the question changes.
  await expect(async () => {
    await page.getByRole('button', { name: '下一題' }).last().click({ timeout: 1000 });
    await expect(page).toHaveURL(/\/exams\/law\/114\/2$/, { timeout: 1000 });
  }).toPass();

  const nextPosition = page.getByText('2 / 80', { exact: true });
  await expect(nextPosition).toBeInViewport();
  const box = await nextPosition.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(60);
  await expect(page.locator('h2').first()).toBeInViewport();
});

/** Every row's marker centres on the first line of its text, and at least one row wraps. */
async function expectMarkerOnFirstLine(rows: Locator, marker: string) {
  const measured = await rows.evaluateAll((elements, selector) => {
    return elements.map((row) => {
      const text = row.querySelector(':scope > span:last-of-type')!;
      const textBox = text.getBoundingClientRect();
      const markerBox = row.querySelector(selector)!.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(row).lineHeight);
      return {
        lines: Math.round(textBox.height / lineHeight),
        drift: Math.abs(
          markerBox.top + markerBox.height / 2 - (textBox.top + lineHeight / 2),
        ),
      };
    });
  }, marker);

  expect(measured.some((row) => row.lines > 1)).toBe(true);
  for (const row of measured) expect(row.drift).toBeLessThanOrEqual(1);
}

test('a long option keeps its letter on the first line', async ({ page }) => {
  await page.goto('/exams/law/114/39');
  const choices = page.getByRole('radiogroup', { name: '題目選項' }).locator('label');
  await expect(choices.first()).toContainText('電氣設備配電場所應設置於地面');
  // The dev server keeps the page hidden until its styles load, and hidden rows measure nothing.
  await expect(choices.first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expectMarkerOnFirstLine(choices, ':scope > span:nth-last-of-type(2)');
  await expectMarkerOnFirstLine(choices, '[role="radio"]');

  const answers = page
    .getByRole('region', { name: '題目選項', exact: true })
    .getByRole('listitem');
  // The button can render before hydration, so retry until the answers show.
  await expect(async () => {
    await page
      .getByRole('button', { name: '看解答', exact: true })
      .click({ timeout: 1000 });
    await expect(answers.first()).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expectMarkerOnFirstLine(answers, 'b');
});

test('posts on past exams stay with the question', async ({ page }) => {
  const content = `考古題討論版頁的共享投稿 ${test.info().project.name}`;
  await page.goto('/exams?question=law-114-03');
  await page.getByRole('tab', { name: /討論區/ }).click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/3\?tab=discussion$/);
  await page.getByLabel('內容').fill(content);
  await page.getByRole('button', { name: '送出共享投稿' }).click();
  await expect(page.locator('article').filter({ hasText: content })).toBeVisible();

  // Moving within the page keeps the loaded posts, so their absence on the next question counts;
  // the open tab follows the question, and the 題目 tab drops the parameter again.
  await questionTile(await questionTiles(page), '第 4 題').click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/4\?tab=discussion$/);
  // Choosing a tile closes the phone drawer, so it is opened again to read the state.
  await expectCurrentTile(questionTile(await questionTiles(page), '第 4 題'));
  await closeQuestionTiles(page);
  await expect(page.locator('article').filter({ hasText: content })).toHaveCount(0);
  await page.getByRole('tab', { name: /^題目$/ }).click();
  await expect(page).toHaveURL(/\/exams\/law\/114\/4$/);
  await page.goto('/exams?question=law-114-03&tab=discussion');
  await expect(page.getByRole('tab', { name: /討論區/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('article').filter({ hasText: content })).toBeVisible();
});

test('past exams questions are in the static HTML', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  const response = await request.get('/exams');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('依建築法規定，下列敘述何者錯誤？');
});
