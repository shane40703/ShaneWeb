import { expect, test } from '@playwright/test';

test('default draws persist for five sets while advanced draws leave the cycle alone', async ({ page }) => {
  test.setTimeout(120_000);
  const historyKey = 'shaneweb:default-practice-draws:v1';
  const history = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), historyKey);

  async function openSetup() {
    await page.goto('/practice/quiz');
    const setup = page.getByRole('region', { name: '每日抽題練習設定' });
    await setup.getByRole('radio', { name: /營建法規與實務/ }).check();
    await expect(setup.getByText(/已選 法規・從 \d+ 題中抽 50 題/)).toBeVisible({ timeout: 60_000 });
    return setup;
  }

  for (let index = 0; index < 5; index++) {
    const setup = await openSetup();
    await setup.getByRole('button', { name: '線上作答', exact: true }).click();
    await expect(page).toHaveURL(/\?q=1$/);
    expect((await history()).law).toHaveLength(index + 1);
  }
  const five = (await history()).law as string[][];
  expect(five.every((draw) => draw.length === 50)).toBe(true);
  expect(new Set(five.flat()).size).toBe(250);

  const advanced = await openSetup();
  await advanced.getByRole('button', { name: /進階選項/ }).click();
  await advanced.getByRole('button', { name: /^5 題/ }).click();
  await advanced.getByRole('button', { name: '線上作答', exact: true }).click();
  await expect(page).toHaveURL(/\?q=1$/);
  expect((await history()).law).toEqual(five);

  const sixth = await openSetup();
  await sixth.getByRole('button', { name: '線上作答', exact: true }).click();
  await expect(page).toHaveURL(/\?q=1$/);
  expect((await history()).law).toHaveLength(1);
});
