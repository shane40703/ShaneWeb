import { expect, test } from '@playwright/test';

test('category search and discussion notes work at the current viewport', async ({ page }, testInfo) => {
  await page.goto('/resources/analysis?subject=law&year=114');
  const distribution = page.getByRole('region', { name: '命題分類與對應考古題' });
  const search = distribution.getByRole('searchbox', { name: '搜尋相關法規' });
  await search.fill('都市');
  await expect(distribution.getByRole('button', { name: /^都市計畫法\s/ })).toBeVisible();
  await expect(distribution.getByRole('button', { name: /建築技術規則/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (page.viewportSize()!.width <= 520) {
    const title = await distribution.getByText('114 年命題分布').boundingBox();
    const input = await search.boundingBox();
    expect(input!.y).toBeGreaterThan(title!.y + title!.height);
  }
  await distribution.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('category-search.png') });
  await search.fill('完全不存在的法規');
  await expect(distribution.getByRole('status')).toContainText('找不到符合的分類');
  await search.fill('');
  await expect(distribution.getByRole('button', { name: /建築技術規則/ })).toBeVisible();

  await page.goto('/exams/law/114/1?tab=notes');
  const options = page.getByRole('region', { name: '題目選項' });
  await expect(options.locator('li')).toHaveCount(4);
  await expect(page.getByLabel('我的筆記')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await options.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('note-options.png') });
});

test('searching both category lists keeps their height and the selected trend lines', async ({ page, isMobile }, testInfo) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/resources/analysis?subject=law&year=all&fromYear=100&toYear=114');
  await expect(page.getByText('跨年度命題分布')).toBeVisible();
  const distribution = page.getByRole('region', { name: '命題分類與對應考古題' });
  const list = distribution.locator('[class*="lawList"]');
  const search = distribution.getByRole('searchbox', { name: '搜尋相關法規' });
  const originalHeight = (await list.boundingBox())!.height;
  const distributionHeight = (await distribution.boundingBox())!.height;
  await search.fill('都市');
  expect((await list.boundingBox())!.height).toBe(originalHeight);
  expect((await distribution.boundingBox())!.height).toBe(distributionHeight);
  await search.fill('沒有此分類');
  expect((await list.boundingBox())!.height).toBe(originalHeight);
  expect((await distribution.boundingBox())!.height).toBe(distributionHeight);
  await search.fill('古蹟歷史建築及聚落修復');
  await expect(distribution.getByRole('button', { name: /古蹟歷史建築及聚落修復/ })).toBeVisible();
  expect((await distribution.boundingBox())!.height).toBe(distributionHeight);
  await search.fill('');

  await page.getByText('詳細趨勢分析', { exact: true }).click();
  const picker = page.getByRole('group', { name: '比較分類清單' });
  const trendSearch = page.getByRole('searchbox', { name: '搜尋比較分類' });
  const pickerHeight = (await picker.boundingBox())!.height;
  const chart = page.getByRole('region', { name: '跨年度分類折線圖' });
  const linesBefore = await chart.locator('polyline').count();
  await trendSearch.fill('都市');
  await expect(picker.getByRole('checkbox', { name: /^都市計畫法/ }).first()).toBeVisible();
  expect((await picker.boundingBox())!.height).toBe(pickerHeight);
  expect(await chart.locator('polyline').count()).toBe(linesBefore);
  await page.getByRole('region', { name: '選擇比較分類' }).screenshot({ path: testInfo.outputPath('trend-search.png') });
  await trendSearch.fill('沒有此分類');
  await expect(picker.getByRole('status')).toContainText('找不到符合的分類');
  expect((await picker.boundingBox())!.height).toBe(pickerHeight);
  await trendSearch.fill('');
  expect(await chart.locator('polyline').count()).toBe(linesBefore);
});

test('starts the entire selected category directly across years', async ({ page }) => {
  await page.goto('/resources/analysis?subject=law&year=all&fromYear=100&toYear=114');
  await expect(page.getByText('跨年度命題分布')).toBeVisible();
  const distribution = page.getByRole('region', { name: '命題分類與對應考古題' });
  await distribution.getByRole('button', { name: /^建築技術規則\s/ }).click();
  const originalIds = await distribution.locator('[class*="lawQuestions"] a').evaluateAll((links) => links.map((link) => {
    const match = link.getAttribute('href')!.match(/\/exams\/law\/(\d+)\/(\d+)$/)!;
    return `law-${match[1]}-${match[2].padStart(2, '0')}`;
  }));
  expect(originalIds.length).toBeGreaterThan(50);
  await distribution.getByRole('button', { name: '作答此分類所有題目' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!));
  expect(saved.category).toBe('建築技術規則');
  expect(saved.questionIds.length).toBeGreaterThan(50);
  expect(new Set(saved.questionIds).size).toBe(saved.questionIds.length);
  const excluded = ['law-103-56', 'law-103-73', 'law-104-47', 'law-105-38', 'law-107-47'];
  for (const id of excluded) {
    expect(saved.questionIds).not.toContain(id);
  }
  expect([...saved.questionIds].sort()).toEqual(originalIds.filter((id) => !excluded.includes(id)).sort());
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
});

test('analysis charts animate as they enter view and update with the selected data', async ({ page }) => {
  await page.goto('/resources/analysis?subject=law&year=114');
  const distribution = page.locator('[class*="lawList"]');
  const bar = distribution.locator('button > i > span').first();
  await distribution.scrollIntoViewIfNeeded();
  await expect(distribution).toHaveAttribute('data-chart-motion', 'true');
  await expect(bar).toHaveCSS('animation-name', /analysis-bar-in/);
  const sharedBar = distribution.getByRole('button', { name: /建築技術規則/ }).locator('i > span');
  const previousWidth = await sharedBar.evaluate((element) => (element as HTMLElement).style.width);
  await expect(sharedBar).toHaveCSS('transition-duration', '0.35s');

  const pieSection = page.getByRole('region', { name: '圓形命題占比圖' });
  const pie = pieSection.locator('[class*="pieGraphic"]');
  const pieRing = pieSection.getByRole('img');
  await pieRing.scrollIntoViewIfNeeded();
  await expect(pieRing).toHaveAttribute('data-chart-motion', 'true');
  await expect(pie).toHaveCSS('animation-name', /analysis-pie-in/);
  const oldGraphic = await pie.elementHandle();
  await page.getByRole('region', { name: '分析條件' }).getByRole('button', { name: '113 年', exact: true }).click();
  await expect(page.getByText('113 年命題分布')).toBeVisible();
  expect(await oldGraphic!.evaluate((element) => element.isConnected)).toBe(false);
  await expect.poll(() => sharedBar.evaluate((element) => (element as HTMLElement).style.width)).not.toBe(previousWidth);
  await expect(pie).toHaveCSS('background-image', /conic-gradient/);
  const yearControls = page.getByRole('region', { name: '分析條件' });
  await yearControls.getByRole('button', { name: '114 年', exact: true }).click();
  await yearControls.getByRole('button', { name: '113 年', exact: true }).click();
  await expect(page.getByText('113 年命題分布')).toBeVisible();

  await page.getByText('詳細趨勢分析', { exact: true }).click();
  const chart = page.getByRole('region', { name: '跨年度分類折線圖' });
  const scroll = chart.locator('[class*="trendChartScroll"]');
  const line = chart.locator('polyline').first();
  await chart.scrollIntoViewIfNeeded();
  await expect(scroll).toHaveAttribute('data-chart-motion', 'true');
  await expect(line).toHaveCSS('animation-name', /analysis-line-in/);
  await expect(line).toHaveAttribute('pathLength', '1');
  await expect(chart.getByRole('img')).toHaveAttribute('aria-label', /分類出題數量折線圖/);
  const oldLine = await line.elementHandle();
  await page.getByLabel('趨勢起始年度').selectOption('101');
  expect(await oldLine!.evaluate((element) => element.isConnected)).toBe(false);
  await expect(line).toHaveCSS('animation-name', /analysis-line-in/);
});

test('charts stay readable when the browser has no intersection observer', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the fallback is independent of viewport size');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true });
  });
  await page.goto('/resources/analysis?subject=law&year=114');
  const bar = page.locator('[class*="lawList"] button > i > span').first();
  await bar.scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
  await expect(bar).toHaveCSS('animation-name', 'none');
  const pie = page.locator('[class*="pieGraphic"]');
  await pie.scrollIntoViewIfNeeded();
  await expect(pie).toBeVisible();
  await expect(pie).toHaveCSS('clip-path', 'none');
  await page.getByText('詳細趨勢分析', { exact: true }).click();
  const line = page.getByRole('region', { name: '跨年度分類折線圖' }).locator('polyline').first();
  await line.scrollIntoViewIfNeeded();
  await expect(line).toBeVisible();
  await expect(line).toHaveCSS('animation-name', 'none');
});

test('reduced motion keeps all three charts visible without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/resources/analysis?subject=law&year=114');
  const distribution = page.locator('[class*="lawList"]');
  await distribution.scrollIntoViewIfNeeded();
  const bar = distribution.locator('button > i > span').first();
  await expect(bar).toHaveCSS('animation-name', 'none');
  await expect(bar).toHaveCSS('transition-duration', '0s');

  const pieSection = page.getByRole('region', { name: '圓形命題占比圖' });
  await pieSection.scrollIntoViewIfNeeded();
  await expect(pieSection.locator('[class*="pieGraphic"]')).toHaveCSS('animation-name', 'none');
  await page.getByText('詳細趨勢分析', { exact: true }).click();
  const chart = page.getByRole('region', { name: '跨年度分類折線圖' });
  await chart.scrollIntoViewIfNeeded();
  await expect(chart.locator('polyline').first()).toHaveCSS('animation-name', 'none');
  await expect(chart.locator('circle').first()).toHaveCSS('opacity', '1');
});
