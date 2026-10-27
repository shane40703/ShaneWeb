import { expect, test } from '@playwright/test';

test('practice copy describes the audience and daily subject choices contain names only', async ({ page }, testInfo) => {
  await page.goto('/practice');
  const descriptions = [
    ['每日抽題練習', '從歷屆考古題抽題，並隨機打亂選項，適合讀書已有一定實力的考生'],
    ['歷屆試題模擬考', '自選 100～114 年任一份考古題，模擬考試時的實際作答，適合全部考生'],
    ['法規克漏字', '適合法規已經背誦到滾瓜爛熟，想挑戰自我的考生'],
  ];
  for (const [title, description] of descriptions) {
    await expect(page.getByRole('article', { name: title, exact: true }).getByText(description, { exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('practice-descriptions.png'), fullPage: true });
  await page.getByRole('article', { name: '每日抽題練習', exact: true }).getByRole('link').click();
  const setup = page.getByRole('region', { name: '每日抽題練習設定', exact: true });
  const choices = setup.getByRole('group', { name: '選擇科目', exact: true });
  await expect(choices.getByRole('radio')).toHaveCount(4);
  await expect(choices.locator('small')).toHaveCount(0);
  await expect(setup.getByRole('button', { name: '線上作答', exact: true })).toBeDisabled();
  for (const name of ['建築法規與實務', '建築環境控制', '建築構造與施工', '建築結構']) {
    await expect(choices.getByRole('radio', { name, exact: true })).toBeVisible();
  }
  await choices.getByRole('radio', { name: '建築法規與實務', exact: true }).check();
  await expect(setup.getByRole('button', { name: '線上作答', exact: true })).toBeEnabled();
  await expect(choices.locator('small')).toHaveCount(0);
  await expect(choices.getByText(/題庫.*題|這次抽/)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('shaneweb:practice-session'))).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('subjects-without-subtitles.png'), fullPage: true });
});

test('renamed personal pages keep their original URLs and have matching page and browser titles', async ({ page }) => {
  for (const [path, title] of [['/notes', '我的筆記'], ['/history', '歷屆試題作答履歷']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page).toHaveTitle(`${title}｜建築師考試`);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});
