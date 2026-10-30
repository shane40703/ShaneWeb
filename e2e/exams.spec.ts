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

async function closeQuestionTiles(page: Page) {
  if (!onPhone()) return;
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '題號導覽' })).toHaveCount(0);
}

/** On phones the subject / year selector sits behind a summary button and folds after a choice. */
async function expandSelector(page: Page) {
  if (onPhone()) await page.getByRole('button', { name: '展開科目與年度' }).click();
}

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
  await expect(numbers.getByRole('button', { name: '第 1 題' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await closeQuestionTiles(page);
  // On phones the compact bar above the tabs and the panel footer both offer 上一題／下一題;
  // the first match is the bar's icon button (on desktop the bar is hidden, so the footer's).
  await page.getByRole('button', { name: '下一題' }).first().click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-02$/);
  await page.getByRole('button', { name: '上一題' }).first().click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-01$/);
  await expandSelector(page);
  await page
    .getByRole('group', { name: '年度' })
    .getByRole('button', { name: '112 年' })
    .click();
  await expect(page).toHaveURL(/\/exams\?question=law-112-01$/);
  if (onPhone())
    await expect(page.getByRole('button', { name: '展開科目與年度' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  await expandSelector(page);
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
  const content = `考古題討論版頁的共享投稿 ${test.info().project.name}`;
  await page.goto('/exams?question=law-114-03');
  await page.getByRole('tab', { name: /討論區/ }).click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-03&tab=discussion$/);
  await page.getByLabel('內容').fill(content);
  await page.getByRole('button', { name: '送出共享投稿' }).click();
  await expect(page.locator('article').filter({ hasText: content })).toBeVisible();

  // Moving within the page keeps the loaded posts, so their absence on the next question counts;
  // the open tab follows the question, and the 題目 tab drops the parameter again.
  await (await questionTiles(page)).getByRole('button', { name: '第 4 題' }).click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-04&tab=discussion$/);
  // Choosing a tile closes the phone drawer, so it is opened again to read the state.
  await expect(
    (await questionTiles(page)).getByRole('button', { name: '第 4 題' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await closeQuestionTiles(page);
  await expect(page.locator('article').filter({ hasText: content })).toHaveCount(0);
  await page.getByRole('tab', { name: /^題目$/ }).click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-04$/);
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
