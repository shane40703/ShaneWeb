import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`${theme} charts and legends share the seven muted rainbow colors`, async ({ page }) => {
    await page.addInitScript((mode) => localStorage.setItem('shane-web-theme', mode), theme);
    await page.goto('/resources/analysis?subject=law&year=114');
    await page.getByText('詳細趨勢分析', { exact: true }).click();
    const picker = page.getByRole('group', { name: '比較分類清單' });
    for (let index = 3; index < 7; index++) await picker.getByRole('checkbox').nth(index).check();
    await expect(page.getByText('已選 7／7')).toBeVisible();
    await expect(picker.getByRole('checkbox').nth(7)).toBeDisabled();
    const chart = page.getByRole('region', { name: '跨年度分類折線圖' });
    const colors = await chart.locator('polyline').evaluateAll((lines) => lines.map((line) => getComputedStyle(line).stroke));
    const swatches = await chart.locator('i').evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    const expected = theme === 'light'
      ? ['rgb(173, 98, 101)', 'rgb(180, 124, 80)', 'rgb(153, 136, 62)', 'rgb(95, 139, 112)', 'rgb(87, 134, 166)', 'rgb(116, 117, 165)', 'rgb(152, 114, 158)']
      : ['rgb(204, 144, 147)', 'rgb(207, 161, 120)', 'rgb(196, 180, 110)', 'rgb(143, 178, 155)', 'rgb(135, 172, 197)', 'rgb(155, 159, 199)', 'rgb(178, 149, 190)'];
    expect(colors).toEqual(expected);
    expect(swatches).toEqual(expected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('wide screens keep the chart visible while the category list is scrolled and edited', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wide comparison layout is tested on desktop');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/resources/analysis?subject=law&year=114');
  await page.getByText('詳細趨勢分析', { exact: true }).click();
  const workbench = page.locator('[class*="trendWorkbench"]');
  await workbench.evaluate((element) => {
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 85, behavior: 'instant' });
  });
  const picker = page.getByRole('group', { name: '比較分類清單' });
  const chart = page.getByRole('region', { name: '跨年度分類折線圖' });
  const pickerBox = await picker.boundingBox();
  const chartBox = await chart.boundingBox();
  expect(pickerBox).not.toBeNull();
  expect(chartBox).not.toBeNull();
  expect(pickerBox!.x + pickerBox!.width).toBeLessThan(chartBox!.x);
  expect(chartBox!.y).toBeGreaterThanOrEqual(64);
  expect(chartBox!.y + chartBox!.height).toBeLessThanOrEqual(768);
  expect(await picker.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  const before = await page.evaluate(() => window.scrollY);
  await picker.focus();
  await page.keyboard.press('End');
  await expect.poll(() => picker.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  const last = picker.getByRole('checkbox').last();
  const label = (await last.locator('..').textContent())!.trim();
  await last.check();
  await expect(last).toBeChecked();
  await expect(chart.locator('polyline')).toHaveCount(4);
  await expect(page.getByText('已選 4／7')).toBeVisible();
  expect(label.length).toBeGreaterThan(0);
  const afterChart = await chart.boundingBox();
  expect(afterChart!.y + afterChart!.height).toBeLessThanOrEqual(768);
});

test('narrow screens keep the list compact and explain how to scroll the chart', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'narrow layout is tested on mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resources/analysis?subject=law&year=114');
  await page.getByText('詳細趨勢分析', { exact: true }).click();
  const picker = page.getByRole('group', { name: '比較分類清單' });
  const chart = page.getByRole('region', { name: '跨年度分類折線圖' });
  const pickerBox = await picker.boundingBox();
  const chartBox = await chart.boundingBox();
  expect(pickerBox!.height).toBeLessThanOrEqual(200);
  expect(pickerBox!.y + pickerBox!.height).toBeLessThan(chartBox!.y);
  await expect(page.getByText('左右滑動查看完整年份')).toBeVisible();
  const scroller = page.getByRole('region', { name: '折線圖橫向捲動區' });
  expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await picker.getByRole('checkbox').nth(3).check();
  await expect(chart.locator('polyline')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
