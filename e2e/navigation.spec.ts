import { expect, test, type Page } from '@playwright/test';

const personal = {
  label: '我的作答存摺',
  links: [
    ['使用者筆記', '/notes'],
    ['難題標記', '/difficult'],
    ['常錯題目', '/wrong'],
    ['已作答紀錄', '/history'],
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

test('navigation lists only the new pages and 我的作答存摺, and returns home via the brand', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  const links = nav.locator(':scope > a');
  await expect(links).toHaveText(['每日練習', '歷屆試題', '統計分析']);
  await expect(links.nth(0)).toHaveAttribute('href', '/practice');
  await expect(links.nth(1)).toHaveAttribute('href', '/exams');
  await expect(links.nth(2)).toHaveAttribute('href', '/resources');
  await expect(nav.getByRole('button')).toHaveText([personal.label]);
  for (const removed of ['詳解與討論', '歷屆試題題練習', '歷屆試題資料集成'])
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

test('我的作答存摺 contains its pages and supports click, navigation, and active states', async ({
  page,
}) => {
  await page.goto('/');
  for (const [label, href] of personal.links) {
    await openNavigation(page);
    await page.getByRole('button', { name: personal.label, exact: true }).click();
    const popup = page.getByRole('group', {
      name: `${personal.label}子選單`,
      exact: true,
    });
    await expect(popup.getByRole('link')).toHaveCount(personal.links.length);
    for (const [child, path] of personal.links)
      await expect(popup.getByRole('link', { name: child, exact: true })).toHaveAttribute(
        'href',
        path,
      );
    await popup.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(popup).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
      0,
    );
    await openNavigation(page);
    const trigger = page.getByRole('button', { name: personal.label, exact: true });
    await expect(trigger).toHaveAttribute('data-active', 'true');
    await trigger.click();
    await expect(popup.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page
      .getByRole('button', { name: `關閉${personal.label}子選單`, exact: true })
      .click();
    const drawer = page.getByRole('dialog', { name: '主要功能', exact: true });
    if (await drawer.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
    }
  }
});

test('desktop hover opens a usable submenu without stealing focus and closes after leaving', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Touch devices use explicit taps.');
  await page.goto('/');
  const trigger = page.getByRole('button', { name: personal.label, exact: true });
  await page.getByRole('link', { name: '建築師考試首頁' }).focus();
  await trigger.hover();
  const popup = page.getByRole('group', { name: `${personal.label}子選單` });
  await expect(popup).toBeVisible();
  await expect(page.getByRole('link', { name: '建築師考試首頁' })).toBeFocused();
  await popup.getByRole('link', { name: '常錯題目', exact: true }).hover();
  await expect(popup).toBeVisible();
  await page.mouse.move(650, 30);
  await expect(popup).toHaveCount(0);
});

test('keyboard Enter and Escape work without viewport overflow', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await openNavigation(page);
  const trigger = page.getByRole('button', { name: personal.label, exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popup = page.getByRole('group', { name: `${personal.label}子選單` });
  await expect(
    popup.getByRole('link', { name: '使用者筆記', exact: true }),
  ).toBeFocused();
  const rect = (await popup.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('navigation-submenu.png') });
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('clicking or tapping the group trigger again closes the child list without navigating', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  const trigger = nav.getByRole('button', { name: personal.label, exact: true });
  if (isMobile) await trigger.tap();
  else await trigger.click();
  const popup = page.getByRole('group', { name: `${personal.label}子選單` });
  await expect(popup).toBeVisible();
  if (isMobile) await trigger.tap();
  else await trigger.click();
  await expect(popup).toHaveCount(0);
  await expect(nav).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
