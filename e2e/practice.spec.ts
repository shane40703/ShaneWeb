import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

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

async function openSetup(page: Page) {
  await page.goto('/practice/quiz');
  const setup = page.getByRole('region', { name: '選擇題練習設定' });
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
  await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
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
  await expect(page).toHaveURL(/\/practice\/quiz$/);
  expect(
    await page.evaluate(() => localStorage.getItem('shaneweb:practice-session')),
  ).toBeNull();
});

test('the hub opens the multiple-choice practice, and leads back to the set and its result', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/practice');
  await expect(page).toHaveTitle('每日練習（新版）｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('每日練習（新版）');
  const quiz = page.getByRole('article', { name: '選擇題練習' });
  const cloze = page.getByRole('article', { name: '法規克漏字' });
  await expect(quiz.getByText('選科目開始')).toBeVisible();
  await expect(cloze.getByText('還沒開始')).toBeVisible();
  await expect(quiz.getByRole('link', { name: /建築法規與實務/ })).toContainText(
    /[\d,]+ 題/,
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('hub.png'), fullPage: true });

  await quiz.getByRole('link', { name: /建築環境控制/ }).click();
  await expect(page).toHaveURL(/\/practice\/quiz$/);
  await expect(page).toHaveTitle('選擇題練習｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('選擇題練習');
  await expect(page.getByRole('radio', { name: /建築環境控制/ })).toBeChecked();
  const nav = await openNavigation(page);
  await expect(
    nav.getByRole('link', { name: '每日練習（新版）', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
      0,
    );
  }

  await page.getByRole('button', { name: /進階選項/ }).click();
  await page.getByRole('button', { name: /^5 題/ }).click();
  await page.getByRole('button', { name: '線上作答' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
  const question = page.getByRole('region', { name: '題目與選項' });
  await question.getByRole('radio').first().click();
  await page.getByRole('button', { name: '確認答案' }).click();
  await expect(question.getByRole('status')).toContainText(/答對了|答錯了/);
  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page).toHaveURL(/\?q=2$/);
  await page.screenshot({ path: testInfo.outputPath('quiz.png') });

  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(quiz.getByText('進行中的題組')).toBeVisible();
  await expect(quiz.getByText(/^已作答 1／5 題・答對 [01] 題$/)).toBeVisible();
  await quiz.getByRole('link', { name: '繼續第 2 題' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=2$/);
  await expect(page.getByLabel('第 2 題，共 5 題')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('complementary', { name: '題組資訊' })
    .getByRole('button', { name: /交卷/ })
    .click();
  await expect(page).toHaveURL(/\?view=result$/);
  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(quiz.getByText('剛交卷')).toBeVisible();
  await expect(quiz.getByText(/^答對 [01]／1 題・正確率 (0|100)%$/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('hub-result.png'), fullPage: true });
  await quiz.getByRole('link', { name: '看結果' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?view=result$/);
  await expect(page.getByText(/^(0|100)% 正確率$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('law cloze opens from the hub, shares its round with the old page, and starts the next round from the hub', async ({
  page,
}, testInfo) => {
  await page.goto('/practice');
  const cloze = page.getByRole('article', { name: '法規克漏字' });
  await cloze.getByRole('link', { name: '開始練習' }).click();
  await expect(page).toHaveURL(/\/practice\/law-cloze$/);
  await expect(page).toHaveTitle('法規克漏字｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('法規克漏字');
  await page.getByRole('combobox', { name: '每次測驗題數' }).selectOption('5');
  await page.getByRole('button', { name: '開始新測驗' }).click();
  await expect(page.getByText(/^1 \/ 5$/)).toBeVisible();

  await page.getByRole('button', { name: '直接看答案' }).click();
  const evidence = page.locator('details').filter({ hasText: '題型相關考古題' });
  await evidence.locator('summary').click();
  await expect(evidence.getByRole('link').first()).toHaveAttribute(
    'href',
    /^\/exams\?question=law-\d{3}-\d{2}$/,
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('cloze.png'), fullPage: true });

  // The old page keeps its own links but continues the same round.
  const title = await page.locator('form h3').textContent();
  await page.goto('/law-cloze');
  await expect(page.locator('form h3')).toHaveText(title!);
  await page
    .locator('details')
    .filter({ hasText: '題型相關考古題' })
    .locator('summary')
    .click();
  await expect(
    page
      .locator('details')
      .filter({ hasText: '題型相關考古題' })
      .getByRole('link')
      .first(),
  ).toHaveAttribute('href', /^\/questions\/law\/\d{3}\/\d{2}$/);

  await page.goto('/practice');
  await expect(cloze.getByText('已完成 1／5 題・全對 0 題')).toBeVisible();
  await cloze.getByRole('link', { name: '繼續本輪' }).click();
  await expect(page).toHaveURL(/\/practice\/law-cloze$/);
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: '下一題' }).click();
    await page.getByRole('button', { name: '直接看答案' }).click();
  }
  await expect(page.getByRole('heading', { name: '本輪測驗完成' })).toBeVisible();

  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(cloze.getByText('本輪完成')).toBeVisible();
  await expect(cloze.getByText('直接看答案 5 題，不計分')).toBeVisible();
  await cloze.getByRole('button', { name: '再練一輪' }).click();
  await expect(page).toHaveURL(/\/practice\/law-cloze$/);
  await expect(page.getByText(/^1 \/ 5$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '本輪測驗完成' })).toHaveCount(0);
});
