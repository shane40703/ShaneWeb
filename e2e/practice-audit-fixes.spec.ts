import { expect, test } from '@playwright/test';

test('keeps the chosen category and explains excluded all-credit questions', async ({ page }) => {
  await page.goto('/practice/quiz');
  const setup = page.getByRole('region', { name: '每日抽題練習設定' });
  await setup.getByRole('radio', { name: /營建法規與實務/ }).check();
  await expect(setup.getByText(/已選 法規・從 \d+ 題中抽 50 題/)).toBeVisible({ timeout: 60_000 });
  await setup.getByRole('button', { name: /進階選項/ }).click();
  const category = setup.getByRole('combobox', { name: '題目類別' });
  await category.selectOption('建築技術規則');
  await setup.getByLabel('起始年度').selectOption('112');
  await setup.getByLabel('結束年度').selectOption('112');
  await expect(category).toHaveValue('建築技術規則');
  await expect(setup.getByText('已排除 1 題一律給分題目。')).toBeVisible();
  await setup.getByRole('checkbox', { name: /包含一律給分題目/ }).check();
  await expect(category).toHaveValue('建築技術規則');
  await expect(setup.getByText('已排除 1 題一律給分題目。')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('phone touch targets are at least 44px and elimination does not select an answer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the larger targets are for the narrow touch layout');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/practice/quiz');
  const setup = page.getByRole('region', { name: '每日抽題練習設定' });
  await setup.getByRole('radio', { name: /營建法規與實務/ }).check();
  await expect(setup.getByRole('button', { name: '線上作答' })).toBeEnabled({ timeout: 60_000 });
  await setup.getByRole('button', { name: '線上作答' }).tap();
  const difficult = page.getByRole('button', { name: '標記為難題', exact: true });
  const eliminate = page.getByRole('button', { name: '刪去選項 A', exact: true });
  for (const button of [difficult, eliminate]) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await difficult.tap();
  await expect(page.getByRole('button', { name: '取消難題標記' })).toHaveAttribute('aria-pressed', 'true');
  await eliminate.tap();
  await expect(page.getByRole('button', { name: '恢復選項 A' })).toBeVisible();
  await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
  // Distinct gestures, not the deliberately ignored second click of a double tap.
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '恢復選項 A' }).tap();
  await expect(page.getByRole('button', { name: '刪去選項 A' })).toBeVisible();
  await page.getByRole('radio').first().check();
  await expect(page.getByRole('button', { name: '確認答案' })).toBeEnabled();
});
