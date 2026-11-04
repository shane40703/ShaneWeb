import { expect, test } from '@playwright/test';

test('all matching questions follows the selected range and category', async ({ page }) => {
  await page.goto('/practice/quiz');
  const setup = page.getByRole('region', { name: '每日抽題練習設定' });
  await setup.getByRole('radio', { name: /營建法規與實務/ }).check();
  await expect(setup.getByText(/已選 法規・從 \d+ 題中抽 50 題/)).toBeVisible({ timeout: 60_000 });
  await setup.getByRole('button', { name: /進階選項/ }).click();
  await setup.getByLabel('起始年度').selectOption('109');
  await setup.getByLabel('結束年度').selectOption('111');
  await setup.getByRole('combobox', { name: '題目類別' }).selectOption({ label: '建築技術規則（60 題）' });
  const all = setup.getByRole('button', { name: /作答該類別所有題目/ });
  await expect(all).toContainText('60 題');
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(setup.getByText('已選 法規・從 60 題中抽 60 題')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await setup.getByRole('button', { name: '線上作答' }).click();
  await expect(page.getByLabel('第 1 題，共 60 題')).toBeVisible();
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!).questionIds as string[]);
  expect(ids).toHaveLength(60);
  expect(new Set(ids).size).toBe(60);
  await page.reload();
  await expect(page.getByLabel('第 1 題，共 60 題')).toBeVisible();
});
