import { expect, test, type Page } from '@playwright/test';

const sections = [
  { label: '歷屆試題題練習', links: [['歷屆試題', '/papers'], ['隨機出題', '/random'], ['法規克漏字', '/law-cloze']] },
  { label: '歷屆試題資料集成', links: [['考題分析', '/analysis'], ['速記圖庫', '/memory-gallery'], ['法規資料庫', '/laws']] },
  { label: '我的作答存摺', links: [['使用者筆記', '/notes'], ['難題標記', '/difficult'], ['常錯題目', '/wrong'], ['已作答紀錄', '/history']] },
];

async function openNavigation(page: Page) {
  const drawer = page.getByRole('button', { name: '開啟選單' });
  if (await drawer.isVisible()) await drawer.click();
  return page.getByRole('navigation', { name: '主要功能', exact: true });
}

test('navigation starts with the new daily practice and past exams, keeps discussion independent, and returns home via the brand', async ({ page }, testInfo) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  await expect(nav.locator(':scope > a').first()).toHaveText('每日練習（新版）');
  await expect(nav.locator(':scope > a').nth(1)).toHaveText('歷屆試題（新版）');
  await expect(nav.locator(':scope > a').nth(1)).toHaveAttribute('href', '/exams');
  await expect(nav.locator(':scope > a').nth(2)).toHaveText('每日練習');
  await expect(nav.getByRole('link', { name: '首頁', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(nav.getByRole('link', { name: '詳解與討論', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('navigation-grouped.png') });
  await nav.getByRole('link', { name: '每日練習', exact: true }).click();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(0);
  await openNavigation(page);
  await page.getByRole('link', { name: '建築師考試首頁', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('首頁');
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(0);
});

for (const section of sections) {
  test(`${section.label} contains the requested links and supports click, navigation, and active states`, async ({ page }, testInfo) => {
    await page.goto('/');
    for (const [label, href] of section.links) {
      await openNavigation(page);
      const trigger = page.getByRole('button', { name: section.label, exact: true });
      await trigger.click();
      const popup = page.getByRole('group', { name: `${section.label}子選單`, exact: true });
      await expect(popup.getByRole('link')).toHaveCount(section.links.length);
      for (const [child, path] of section.links) await expect(popup.getByRole('link', { name: child, exact: true })).toHaveAttribute('href', path);
      await page.screenshot({ path: testInfo.outputPath(`navigation-${href.slice(1)}.png`) });
      await popup.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
      await expect(page.getByRole('group', { name: `${section.label}子選單`, exact: true })).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(0);
      await openNavigation(page);
      await expect(page.getByRole('button', { name: section.label, exact: true })).toHaveAttribute('data-active', 'true');
      await page.getByRole('button', { name: section.label, exact: true }).click();
      await expect(page.getByRole('group', { name: `${section.label}子選單` }).getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
      await page.getByRole('button', { name: `關閉${section.label}子選單`, exact: true }).click();
      const drawer = page.getByRole('dialog', { name: '主要功能', exact: true });
      if (await drawer.isVisible()) { await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); }
    }
  });
}

test('desktop hover opens a usable submenu without stealing focus and closes after leaving', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch devices use explicit taps.');
  await page.goto('/');
  const trigger = page.getByRole('button', { name: sections[0].label, exact: true });
  await page.getByRole('link', { name: '建築師考試首頁' }).focus();
  await trigger.hover();
  const popup = page.getByRole('group', { name: `${sections[0].label}子選單` });
  await expect(popup).toBeVisible();
  await expect(page.getByRole('link', { name: '建築師考試首頁' })).toBeFocused();
  await popup.getByRole('link', { name: '隨機出題', exact: true }).hover();
  await expect(popup).toBeVisible();
  await page.mouse.move(650, 30);
  await expect(popup).toHaveCount(0);
});

test('keyboard Enter and Escape work with only one group open and no viewport overflow', async ({ page, isMobile }, testInfo) => {
  await page.goto('/');
  await openNavigation(page);
  const trigger = page.getByRole('button', { name: sections[0].label, exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popup = page.getByRole('group', { name: `${sections[0].label}子選單` });
  await expect(popup.getByRole('link', { name: '歷屆試題', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  // On a narrow drawer, the flyout intentionally overlays later groups.
  // Dismiss it using its visible close control before choosing another group.
  if (isMobile) await page.getByRole('button', { name: `關閉${sections[0].label}子選單`, exact: true }).click();
  await page.getByRole('button', { name: sections[1].label, exact: true }).click();
  await expect(popup).toHaveCount(0);
  const resources = page.getByRole('group', { name: `${sections[1].label}子選單` });
  await expect(resources).toBeVisible();
  const rect = (await resources.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('navigation-submenu.png') });
});

test('clicking or tapping the group trigger again closes the child list without navigating', async ({ page, isMobile }) => {
  await page.goto('/');
  const nav = await openNavigation(page);
  const trigger = nav.getByRole('button', { name: sections[2].label, exact: true });
  if (isMobile) await trigger.tap(); else await trigger.click();
  const popup = page.getByRole('group', { name: `${sections[2].label}子選單` });
  await expect(popup).toBeVisible();
  if (isMobile) await trigger.tap(); else await trigger.click();
  await expect(popup).toHaveCount(0);
  await expect(nav).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
