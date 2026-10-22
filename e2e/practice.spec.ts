import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

async function openSetup(page: Page) {
  await page.goto('/practice');
  const setup = page.getByRole('region', { name: '每日練習（新版）設定' });
  await expect(setup).toBeVisible();
  await expect(setup.getByText(/已選 法規・從 \d+ 題中抽 50 題/)).toBeVisible({
    timeout: 60_000,
  });
  return setup;
}

test('new daily practice keeps the daily defaults, hides the random options, and answers one question per URL', async ({
  page,
}, testInfo) => {
  const setup = await openSetup(page);
  await expect(setup.getByText(/闖關/)).toHaveCount(0);
  const toggle = page.getByRole('button', { name: /進階選項/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toContainText(
    '50 題・100–114 年・全部類別・打亂選項・不含一律給分',
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('setup.png'), fullPage: true });

  await toggle.click();
  await expect(page.getByRole('button', { name: /^50 題/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('checkbox', { name: /打亂選項順序/ })).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: /包含一律給分題目/ }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: /^5 題/ }).click();
  await expect(toggle).toContainText('5 題・100–114 年');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('advanced.png'), fullPage: true });

  await page.getByRole('button', { name: '線上作答' }).click();
  await expect(page).toHaveURL(/\/practice\?q=1$/);
  const question = page.getByRole('region', { name: '題目與選項' });
  await expect(page.getByLabel('第 1 題，共 5 題')).toBeVisible();
  const confirm = page.getByRole('button', { name: '確認答案' });
  await expect(confirm).toBeDisabled();
  await question.getByRole('radio').first().click();
  await confirm.click();
  await expect(question.getByRole('status')).toContainText(/答對了|答錯了/);
  await expect(page.getByRole('region', { name: /原題第 \d+ 題詳解/ })).toBeVisible();
  await expect(page.getByText('使用者筆記')).toBeVisible();
  await expect(question.getByRole('radio').first()).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('answered.png'), fullPage: true });

  // The footer button sits below the explanation and notes: the next question
  // must still open at the top.
  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page).toHaveURL(/\?q=2$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: '跳過' }).click();
  await expect(page).toHaveURL(/\?q=3$/);
  await page.getByRole('link', { name: '前往第 5 題', exact: true }).click();
  await expect(page).toHaveURL(/\?q=5$/);
  await expect(page.getByLabel('第 5 題，共 5 題')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\?q=3$/);
  await expect(page.getByLabel('第 3 題，共 5 題')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('第 3 題，共 5 題')).toBeVisible();
  const sidebar = page.getByRole('complementary', { name: '題組資訊' });
  await expect(sidebar.getByRole('region', { name: '題號導覽' })).toContainText('1/5');

  page.once('dialog', (dialog) => dialog.accept());
  await sidebar.getByRole('button', { name: /交卷/ }).click();
  await expect(page).toHaveURL(/\?view=result$/);
  await expect(
    page.getByText('共 5 題，作答 1 題，未作答 4 題不計入正確率。'),
  ).toBeVisible();
  await expect(page.getByText(/^(0|100)% 正確率$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });

  // Back shows the blank set; Forward brings the in-memory result back.
  await page.goBack();
  await expect(page).toHaveURL(/\?q=3$/);
  await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
  await page.goForward();
  await expect(page).toHaveURL(/\?view=result$/);
  await expect(page.getByText(/^(0|100)% 正確率$/)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\?q=1$/);
  await expect(page.getByLabel('第 1 題，共 5 題')).toBeVisible();
  await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
  await expect(page.getByText(/% 正確率/)).toHaveCount(0);
});

test('paper download from the setup draws its own set without starting online practice', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'queryLocalFonts', {
      value: undefined,
      configurable: true,
    }),
  );
  await openSetup(page);
  await page.getByRole('button', { name: /進階選項/ }).click();
  await page.getByRole('button', { name: /^5 題/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: '製作紙本檔案' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^建築師每日練習-\d{4}-\d{2}-\d{2}-建築法規與實務\.pdf$/,
  );
  const pdf = await PDFDocument.load(await readFile((await download.path())!));
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/practice$/);
  expect(
    await page.evaluate(() => localStorage.getItem('shaneweb:practice-session')),
  ).toBeNull();
});
