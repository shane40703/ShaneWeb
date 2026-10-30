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

/** The 題號 sheet, which holds the paper's side column at one-column widths. */
async function openPaperSheet(page: Page) {
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  const trigger = page.getByRole('button', { name: '題號', exact: true });
  if (!(await trigger.isVisible())) return null;
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: '題號導覽' });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function goToPaperQuestion(page: Page, number: number) {
  const sheet = await openPaperSheet(page);
  const name = new RegExp(`^前往第 ${number} 題`);
  await (sheet
    ? sheet.getByRole('button', { name })
    : page.getByRole('region', { name: '題號導覽' }).getByRole('link', { name })
  ).click();
}

async function paperActions(page: Page) {
  return (
    (await openPaperSheet(page)) ??
    page.getByRole('complementary', { name: '試卷資訊' })
  );
}

async function openSetup(page: Page) {
  await page.goto('/practice/quiz');
  const setup = page.getByRole('region', { name: '每日抽題練習設定' });
  await expect(setup).toBeVisible();
  await expect(setup.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(setup.getByRole('button', { name: '線上作答', exact: true })).toBeDisabled();
  await setup.getByRole('radio', { name: /建築法規與實務/ }).check();
  await expect(setup.getByText(/已選 法規・從 \d+ 題中抽 50 題/)).toBeVisible({
    timeout: 60_000,
  });
  return setup;
}

test('new daily practice keeps the daily defaults, hides the random options, and answers one question per URL', async ({
  page,
  isMobile,
}, testInfo) => {
  if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
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
  await expect(page.getByText('我的筆記')).toBeVisible();
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
  await sidebar.getByRole('link', { name: '前往第 5 題', exact: true }).click();
  await expect(page.getByRole('button', { name: '完成練習', exact: true })).toHaveCount(0);
  await expect(confirm).toBeDisabled();
  await question.getByRole('radio').first().click();
  await expect(page.getByRole('button', { name: '完成練習', exact: true })).toHaveCount(0);
  await confirm.click();
  await expect(question.getByRole('status')).toContainText(/答對了|答錯了/);
  await expect(confirm).toHaveCount(0);
  await page.getByRole('button', { name: '完成練習', exact: true }).click();
  await expect(page).toHaveURL(/\?view=result$/);
  await expect(
    page.getByText('共 5 題，作答 2 題，未作答 3 題不計入正確率。'),
  ).toBeVisible();
  await expect(page.getByText(/^(0|50|100)% 正確率$/)).toBeVisible();
  const result = page.getByRole('region', { name: '法規練習結果', exact: true });
  const resultWidth = (await result.boundingBox())!.width;
  const availableWidth = await result.evaluate(el => el.parentElement!.parentElement!.parentElement!.clientWidth);
  expect(Math.abs(resultWidth - availableWidth)).toBeLessThanOrEqual(1);
  if (!isMobile) expect(resultWidth).toBeGreaterThan(1180);
  await page.getByRole('button', { name: '本次考題預覽', exact: true }).click();
  await expect(page.getByRole('region', { name: '本次考題預覽', exact: true }).getByRole('article')).toHaveCount(5);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('result.png'), fullPage: true });

  // Back shows the blank set; Forward brings the in-memory result back.
  await page.goBack();
  await expect(page).toHaveURL(/\?q=5$/);
  await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
  await page.goForward();
  await expect(page).toHaveURL(/\?view=result$/);
  await expect(page.getByText(/^(0|50|100)% 正確率$/)).toBeVisible();

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

test('the hub uses three desktop cards and daily practice asks for a fresh subject before optional resume', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/practice');
  await expect(page).toHaveTitle('每日練習｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('每日練習');
  const practices = page.getByRole('article');
  await expect(practices.locator('h2')).toHaveText([
    '每日抽題練習',
    '歷屆試題模擬考',
    '法規克漏字',
  ]);
  await expect(practices.nth(0).getByText(/^4 科・[\d,]+ 題$/)).toBeVisible();
  await expect(practices.nth(2).getByText(/^\d+ 部法規・[\d,]+ 題$/)).toBeVisible();
  await expect(practices.nth(1).getByText(/^\d 科・\d+ 份試卷$/)).toBeVisible();
  // Same card order: horizontal on desktop, stacked on phones.
  const list = page.getByRole('list').filter({ has: page.getByRole('article') });
  await expect(list.getByRole('link')).toHaveCount(3);
  await expect(list.getByRole('button')).toHaveCount(0);
  const boxes = await practices.evaluateAll((items) =>
    items.map((item) => {
      const { left, top, bottom } = item.getBoundingClientRect();
      return { left, top, bottom };
    }),
  );
  if (isMobile) {
    expect(new Set(boxes.map((box) => box.left)).size).toBe(1);
    boxes.slice(1).forEach((box, index) => expect(box.top).toBeGreaterThan(boxes[index].bottom));
  } else {
    expect(new Set(boxes.map((box) => box.top)).size).toBe(1);
    expect(new Set(boxes.map((box) => box.left)).size).toBe(3);
    expect(boxes[0].bottom - boxes[0].top).toBeGreaterThanOrEqual(300);
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('hub.png'), fullPage: true });

  await practices.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/practice\/quiz$/);
  await expect(page).toHaveTitle('每日抽題練習｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('每日抽題練習');
  const nav = await openNavigation(page);
  await expect(nav.getByRole('link', { name: '每日練習', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
      0,
    );
  }

  await page.getByRole('radio', { name: /建築環境控制/ }).check();
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

  // Entry does not preselect the previous subject or silently discard its answers.
  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(list.getByRole('link')).toHaveCount(3);
  await practices.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/practice\/quiz$/);
  const setup = page.getByRole('region', { name: '每日抽題練習設定', exact: true });
  await expect(setup.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(setup.getByRole('button', { name: '線上作答', exact: true })).toBeDisabled();
  await setup.getByRole('button', { name: '繼續未完成練習', exact: true }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=2$/);
  await expect(page.getByLabel('第 2 題，共 5 題')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('link', { name: '前往第 5 題', exact: true }).click();
  await question.getByRole('radio').first().click();
  await page.getByRole('button', { name: '確認答案' }).click();
  await page.getByRole('button', { name: '完成練習', exact: true }).click();
  await expect(page).toHaveURL(/\?view=result$/);
  await expect(page.getByText(/^(0|50|100)% 正確率$/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('law cloze opens from the hub and picks its round up again from there', async ({
  page,
}, testInfo) => {
  await page.goto('/practice');
  const cloze = page.getByRole('article', { name: '法規克漏字' });
  await cloze.getByRole('link').click();
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

  // The round survives a reload, and a trip to the hub and back.
  const title = await page.locator('form h3').textContent();
  await page.reload();
  await expect(page.locator('form h3')).toHaveText(title!);
  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await cloze.getByRole('link').click();
  await expect(page).toHaveURL(/\/practice\/law-cloze$/);
  await expect(page.locator('form h3')).toHaveText(title!);
  await expect(page.getByText(/^1 \/ 5$/)).toBeVisible();
});

test('the mock exam answers a whole paper, keeps it when leaving, and scores it on submission', async ({
  page,
}, testInfo) => {
  await page.goto('/practice');
  await page.getByRole('article', { name: '歷屆試題模擬考' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/practice\/mock-exam$/);
  await expect(page).toHaveTitle('歷屆試題模擬考｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('歷屆試題模擬考');

  const setup = page.getByRole('region', { name: '歷屆試題模擬考設定' });
  await expect(setup.getByRole('radio', { name: /建築法規與實務/ })).toBeChecked();
  await setup.getByRole('radio', { name: /建築環境控制/ }).click();
  await expect(page).toHaveURL(/\?subject=env&year=114$/);
  await expect(setup.getByRole('radio', { name: /114 年/ })).toBeChecked();
  // The whole year tile is its radio.
  await setup.getByRole('radio', { name: /113 年/ }).click();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await expect(setup).toContainText('選擇題 40 題，每題 1.5 分，滿分 60 分');
  await expect(setup.getByRole('link', { name: /到考古題討論版閱讀/ })).toHaveAttribute(
    'href',
    '/exams?question=env-113-written-01',
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('mock-setup.png'), fullPage: true });

  await setup.getByRole('button', { name: '開始作答' }).click();
  await expect(page).toHaveURL(/\?subject=env&year=113&q=1$/);
  const question = page.getByRole('region', { name: '題目與選項' });
  await question.getByRole('radio').nth(1).click();
  await expect(page.getByText(/答對了|答錯了/)).toHaveCount(0);
  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page).toHaveURL(/q=2$/);
  await question.getByRole('radio').first().click();
  await page.reload();
  await expect(
    page.getByRole('region', { name: '題目與選項' }).getByRole('radio').first(),
  ).toHaveAttribute('aria-checked', 'true');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('mock-question.png') });

  // Moving around the paper adds no history: Back leaves it for the setup it came from.
  await goToPaperQuestion(page, 5);
  await expect(page).toHaveURL(/q=5$/);
  await goToPaperQuestion(page, 2);
  await expect(page).toHaveURL(/q=2$/);
  await page.goBack();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await page.goForward();
  await expect(page).toHaveURL(/q=2$/);
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();

  await (await paperActions(page)).getByRole('button', { name: /先離開，保留進度/ }).click();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await expect(setup.getByRole('button', { name: '繼續作答（第 3 題）' })).toBeVisible();
  // The paper waits on its setup, whichever way the setup is reached again.
  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await page.getByRole('article', { name: '歷屆試題模擬考' }).getByRole('link').click();
  await setup.getByRole('radio', { name: /建築環境控制/ }).click();
  await setup.getByRole('radio', { name: /113 年/ }).click();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await setup.getByRole('button', { name: '繼續作答（第 3 題）' }).click();
  await expect(page).toHaveURL(/\?subject=env&year=113&q=3$/);

  await (await paperActions(page)).getByRole('button', { name: /交卷/ }).click();
  const check = page.getByRole('alertdialog', { name: '確定要交卷嗎？' });
  await expect(check).toContainText('還有 38 題未作答');
  await expect(check.getByRole('button', { name: '回去檢查' })).toBeFocused();
  await check.getByRole('button', { name: '確定交卷' }).click();
  await expect(page).toHaveURL(/\?subject=env&year=113&result=attempt-/);
  const result = page.getByRole('region', { name: /環控 113 年模擬考結果/ });
  const score = result.getByRole('meter', { name: '模擬考分數' });
  await expect(score).toHaveAttribute('aria-valuetext', /\d+\.\d{2} 分，滿分 60 分/);
  await expect(result.locator('dt')).toHaveText(['答錯題數', '未作答', '作答時間']);
  await expect(result.getByText('未作答', { exact: true }).locator('..')).toContainText('38');
  await expect(page.getByRole('heading', { name: '逐題作答結果' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('mock-result.png'), fullPage: true });

  // The result survives a reload and took the exam's place in history: Back returns
  // to the setup the paper was resumed from, which now offers the result.
  await page.reload();
  await expect(score).toHaveAttribute('aria-valuemax', '60');
  await page.goBack();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await expect(setup.getByRole('link', { name: /查看結果/ })).toBeVisible();
  await page.goForward();
  await expect(score).toHaveAttribute('aria-valuemax', '60');

  await page.goto('/practice/mock-exam?subject=env&year=113');
  await expect(setup.getByRole('button', { name: '開始作答' })).toBeVisible();
  await setup.getByRole('link', { name: /查看結果/ }).click();
  await expect(score).toHaveAttribute('aria-valuemax', '60');
  await page.goto('/history');
  // Saved to 歷屆試題作答履歷 like the original 考古題討論版.
  const year = page.getByRole('group', { name: '113 年作答紀錄' });
  await expect(year.locator('summary')).toContainText('共作答 1 次');
  await year.locator('summary').click();
  await expect(year.getByRole('heading', { name: '建築環境控制・113 年' })).toBeVisible();
});

test('每日抽題練習 explicit saves appear only in 每日練習履歷, and 再做一次 starts the same questions', async ({
  page,
}) => {
  const setup = await openSetup(page);
  await setup.getByRole('button', { name: /進階選項/ }).click();
  await setup.getByRole('button', { name: /^5 題/ }).click();
  await setup.getByRole('button', { name: '線上作答' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
  const question = page.getByRole('region', { name: '題目與選項' });
  await question.getByRole('radio').first().click();
  await page.getByRole('button', { name: '確認答案' }).click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('link', { name: '前往第 5 題', exact: true }).click();
  await question.getByRole('radio').first().click();
  await page.getByRole('button', { name: '確認答案' }).click();
  await page.getByRole('button', { name: '完成練習', exact: true }).click();
  await expect(page.getByText(/^(0|50|100)% 正確率$/)).toBeVisible();

  await page.getByRole('button', { name: '儲存此次作答', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(1);
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: '還沒有作答紀錄', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '每日抽題練習作答紀錄' })).toHaveCount(0);
  await page.goto('/practice-history');
  const group = page.getByRole('group', { name: '每日抽題練習作答紀錄' });
  await group.locator('summary').click();
  const card = group.getByRole('article').first();
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(
    '建築法規與實務・每日抽題練習 5 題',
  );
  await expect(card.getByText(/^正確率 (0|50|100)%$/)).toBeVisible();
  await expect(card.getByText(/^答對 [012]／2 題$/)).toBeVisible();
  await card.getByRole('button', { name: '再做一次' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
  await expect(page.getByLabel('第 1 題，共 5 題')).toBeVisible();
});

test('a paper in one column keeps 下一題 where the thumb left it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'one-column widths only');
  await page.goto('/practice/mock-exam?subject=env&year=113');
  await page.getByRole('button', { name: '開始作答' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  const quiz = page.getByRole('region', { name: '歷屆試題模擬考作答', exact: true });
  const next = quiz.getByRole('article').getByRole('button', { name: /下一題/ });
  const bottom = page.viewportSize()!.height;
  for (let question = 2; question <= 8; question += 1) {
    const box = (await next.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(bottom);
    expect(box.y + box.height).toBeGreaterThan(bottom - 32);
    await next.click();
    await expect(page).toHaveURL(new RegExp(`q=${question}$`));
  }
  await expect(page.getByRole('complementary', { name: '試卷資訊' })).toBeHidden();
  await goToPaperQuestion(page, 30);
  await expect(page).toHaveURL(/q=30$/);
  await expectNoHorizontalOverflow(page);
});

test('the mock exam marks answers on a sheet, not as right or wrong, and checks blanks before 交卷', async ({
  page,
}) => {
  await page.goto('/practice/mock-exam?subject=env&year=113');
  await page.getByRole('button', { name: '開始作答' }).click();
  const question = page.getByRole('region', { name: '題目與選項' });
  await question.getByRole('radio').nth(1).click();
  const quiz = page.getByRole('region', { name: '歷屆試題模擬考作答', exact: true });
  await quiz.getByRole('button', { name: '待檢查', exact: true }).click();
  await expect(quiz.getByRole('button', { name: '待檢查', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(quiz.getByRole('button', { name: '待檢查', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await quiz.getByRole('button', { name: /下一題/ }).click();
  await expect(page).toHaveURL(/q=2$/);
  const actions = await paperActions(page);
  await expect(
    actions.locator('[aria-label="前往第 1 題（已作答 B、待檢查）"]'),
  ).toHaveCSS('background-color', await page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.background = 'var(--surface-3)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }));

  await actions.getByRole('button', { name: /交卷/ }).click();
  const check = page.getByRole('alertdialog', { name: '確定要交卷嗎？' });
  await expect(check.getByRole('button', { name: '回去檢查' })).toBeFocused();
  await expect(check.getByRole('button', { name: /^回到第/ })).toHaveCount(39);
  await check.getByRole('button', { name: '回到第 7 題' }).click();
  await expect(page).toHaveURL(/q=7$/);
  await expect(check).toBeHidden();
  await expect(quiz.getByRole('heading', { name: '第 7 題，共 40 題' })).toBeAttached();
});

test('answering a paper takes the sidebar\'s room in a window too narrow for both', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the phone has no sidebar to give up');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/practice/mock-exam?subject=env&year=113');
  const menu = page.getByRole('button', { name: '開啟選單' });
  await expect(page.getByRole('navigation', { name: '主要功能', exact: true })).toBeVisible();
  await expect(menu).toBeHidden();

  await page.getByRole('button', { name: '開始作答' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  await expect(menu).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主要功能', exact: true })).toBeHidden();
  // Both columns fit now, so the sheet is not needed.
  await expect(page.getByRole('complementary', { name: '試卷資訊' })).toBeVisible();
  await expect(page.getByRole('button', { name: '題號', exact: true })).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('navigation', { name: '主要功能', exact: true })).toBeVisible();
  await expect(menu).toBeHidden();
});

test('the mock exam scores a blank 一律給分 question, as the real exam does', async ({
  page,
}) => {
  // Construction 114 has two 一律給分 questions.
  await page.goto('/practice/mock-exam?subject=construction&year=114');
  await page.getByRole('button', { name: '開始作答' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  await (await paperActions(page)).getByRole('button', { name: /交卷/ }).click();
  const check = page.getByRole('alertdialog', { name: '確定要交卷嗎？' });
  await expect(check).toContainText(
    '還有 80 題未作答，其中 2 題一律給分仍會計分，其餘不給分。',
  );
  await check.getByRole('button', { name: '確定交卷' }).click();
  const result = page.getByRole('region', { name: /構造 114 年模擬考結果/ });
  await expect(result.getByRole('meter', { name: '模擬考分數' }))
    .toHaveAttribute('aria-valuetext', '2.50 分，滿分 100 分');
  await expect(result.getByText('未作答', { exact: true }).locator('..')).toContainText('80');
  await expect(result.getByText('答錯題數', { exact: true }).locator('..')).toContainText('0');
});

test('the home subject cards, 考題分析 and question cards lead to the new pages', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: /建築環境控制/ }).click();
  await expect(page).toHaveURL(/\/practice\/mock-exam\?subject=env$/);
  await expect(
    page.getByRole('region', { name: '歷屆試題模擬考設定' }).getByRole('radio', {
      name: /建築環境控制/,
    }),
  ).toBeChecked();

  await page.goto('/resources/analysis?subject=law&year=114');
  // Each listed question opens in 考古題討論版; nothing leads to the old 作答頁.
  await expect(page.locator('a[href^="/exams?question=law-114-"]').first()).toBeVisible();
  expect(await page.locator('a[href*="/questions/"], a[href*="mode="]').count()).toBe(0);
  await page.getByRole('button', { name: '到每日抽題練習抽題' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz$/);
  await expect(page.getByRole('radio', { name: /建築法規與實務/ })).toBeChecked();
  await expect(page.getByRole('button', { name: /進階選項/ })).toContainText(
    '114–114 年',
  );

  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('shaneweb:state') ?? '{}');
    localStorage.setItem(
      'shaneweb:state',
      JSON.stringify({ ...state, difficultQuestionIds: ['law-114-01'] }),
    );
  });
  await page.goto('/difficult');
  await page.getByRole('button', { name: '查看詳解' }).first().click();
  await expect(page).toHaveURL(/\/exams\?question=law-114-01$/);
});
