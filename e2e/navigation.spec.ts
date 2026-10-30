import { expect, test, type Page } from '@playwright/test';

const personal = {
  label: '我的作答存摺',
  links: [
    ['我的筆記', '/notes'],
    ['難題標記', '/difficult'],
    ['常錯題目', '/wrong'],
    ['每日練習履歷', '/practice-history'],
    ['歷屆試題作答履歷', '/history'],
  ],
};

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

test('navigation lists only the top-level pages, and returns home via the brand', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  const links = nav.locator(':scope > a');
  await expect(links).toHaveText([
    '每日練習',
    '考古題討論版',
    '歷屆試題資料集成',
    personal.label,
  ]);
  await expect(links.nth(0)).toHaveAttribute('href', '/practice');
  await expect(links.nth(1)).toHaveAttribute('href', '/exams');
  await expect(links.nth(2)).toHaveAttribute('href', '/resources');
  await expect(links.nth(3)).toHaveAttribute('href', '/personal');
  await expect(nav.getByRole('button')).toHaveCount(0);
  const removedPages = personal.links.map(([label]) => label);
  for (const removed of ['詳解與討論', '歷屆試題', '統計分析', ...removedPages])
    await expect(nav.getByText(removed, { exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: '設定', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: '問題回報', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('navigation.png') });

  await nav.getByRole('link', { name: '每日練習', exact: true }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
    0,
  );
  await openNavigation(page);
  await page.getByRole('link', { name: '建築師考試首頁', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('首頁');
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
    0,
  );
});

test('我的作答存摺 opens its hub, whose rows reach every page while the sidebar stays current', async ({
  page,
}) => {
  await page.goto('/');
  for (const [label, href] of personal.links) {
    const nav = await openNavigation(page);
    await nav.getByRole('link', { name: personal.label, exact: true }).click();
    await expect(page).toHaveURL(/\/personal$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(personal.label);
    await expect(page.getByRole('heading', { name: /過去一年作答/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
      0,
    );
    const row = page.getByRole('article', { name: label, exact: true });
    await expect(row.getByRole('link')).toHaveAttribute('href', href);
    await row.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await openNavigation(page);
    await expect(
      page.getByRole('link', { name: personal.label, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    const drawer = page.getByRole('dialog', { name: '主要功能', exact: true });
    if (await drawer.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
    }
  }
});

test('the hub rows open their page anywhere along the row and fit a phone', async ({
  page,
}, testInfo) => {
  await page.goto('/personal');
  const links = page.getByRole('article');
  await expect(links).toHaveCount(personal.links.length);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('personal-hub.png'), fullPage: true });
  const row = page.getByRole('article', { name: '常錯題目', exact: true });
  const box = (await row.boundingBox())!;
  await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/wrong$/);
});
