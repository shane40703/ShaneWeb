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

test('the hub links the three practices in one column, and 選擇題練習 picks its set up again', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/practice');
  await expect(page).toHaveTitle('每日練習（新版）｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('每日練習（新版）');
  const practices = page.getByRole('article');
  await expect(practices.locator('h2')).toHaveText([
    '選擇題練習',
    '法規克漏字',
    '歷屆試題模擬考',
  ]);
  await expect(practices.nth(0).getByText(/^4 科・[\d,]+ 題$/)).toBeVisible();
  await expect(practices.nth(1).getByText(/^\d+ 部法規・[\d,]+ 題$/)).toBeVisible();
  await expect(practices.nth(2).getByText(/^\d 科・\d+ 份試卷$/)).toBeVisible();
  // Words and one link each, stacked in a single column: no shortcuts into the pages.
  const list = page.getByRole('list').filter({ has: page.getByRole('article') });
  await expect(list.getByRole('link')).toHaveCount(3);
  await expect(list.getByRole('button')).toHaveCount(0);
  const boxes = await practices.evaluateAll((items) =>
    items.map((item) => {
      const { left, top, bottom } = item.getBoundingClientRect();
      return { left, top, bottom };
    }),
  );
  expect(new Set(boxes.map((box) => box.left)).size).toBe(1);
  boxes
    .slice(1)
    .forEach((box, index) => expect(box.top).toBeGreaterThan(boxes[index].bottom));
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('hub.png'), fullPage: true });

  await practices.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/practice\/quiz$/);
  await expect(page).toHaveTitle('選擇題練習｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('選擇題練習');
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

  // The hub stays the same; the practice itself picks the set up where it stopped.
  await page.getByRole('link', { name: '返回每日練習' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(list.getByRole('link')).toHaveCount(3);
  await practices.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=2$/);
  await expect(page.getByLabel('第 2 題，共 5 題')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('complementary', { name: '題組資訊' })
    .getByRole('button', { name: /交卷/ })
    .click();
  await expect(page).toHaveURL(/\?view=result$/);
  await expect(page.getByText(/^(0|100)% 正確率$/)).toBeVisible();
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
  await expect(
    setup.getByRole('link', { name: /到歷屆試題（新版）閱讀/ }),
  ).toHaveAttribute('href', '/exams?question=env-113-written-01');
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
  const map = page.getByRole('region', { name: '題號導覽' });
  await map.getByRole('link', { name: /^前往第 5 題/ }).click();
  await expect(page).toHaveURL(/q=5$/);
  await map.getByRole('link', { name: /^前往第 2 題/ }).click();
  await expect(page).toHaveURL(/q=2$/);
  await page.goBack();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await page.goForward();
  await expect(page).toHaveURL(/q=2$/);
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();

  await page.getByRole('button', { name: /先離開，保留進度/ }).click();
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

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toMatch(/^還有 38 題未作答/);
    void dialog.accept();
  });
  await page
    .getByRole('complementary', { name: '試卷資訊' })
    .getByRole('button', { name: /交卷/ })
    .click();
  await expect(page).toHaveURL(/\?subject=env&year=113&result=attempt-/);
  const result = page.getByRole('region', { name: /環控 113 年模擬考結果/ });
  await expect(result).toContainText(/\d+\.\d{2} 分／滿分 60 分/);
  await expect(result).toContainText('共 40 題，作答 2 題');
  await expect(page.getByRole('heading', { name: '逐題作答結果' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('mock-result.png'), fullPage: true });

  // The result survives a reload and took the exam's place in history: Back returns
  // to the setup the paper was resumed from, which now offers the result.
  await page.reload();
  await expect(result).toContainText(/分／滿分 60 分/);
  await page.goBack();
  await expect(page).toHaveURL(/\?subject=env&year=113$/);
  await expect(setup.getByRole('link', { name: /查看結果/ })).toBeVisible();
  await page.goForward();
  await expect(result).toContainText(/分／滿分 60 分/);

  await page.goto('/practice/mock-exam?subject=env&year=113');
  await expect(setup.getByRole('button', { name: '開始作答' })).toBeVisible();
  await setup.getByRole('link', { name: /查看結果/ }).click();
  await expect(result).toContainText(/分／滿分 60 分/);
  await page.goto('/history');
  // Saved to 已作答紀錄 like the original 歷屆試題.
  const year = page.getByRole('group', { name: '113 年作答紀錄' });
  await expect(year.locator('summary')).toContainText('共作答 1 次');
  await year.locator('summary').click();
  await expect(year.getByRole('heading', { name: '建築環境控制・113 年' })).toBeVisible();
});

test('選擇題練習 submissions go to 已作答紀錄, and 再做一次 starts the same questions', async ({
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
  await page
    .getByRole('complementary', { name: '題組資訊' })
    .getByRole('button', { name: /交卷/ })
    .click();
  await expect(page.getByText(/^(0|100)% 正確率$/)).toBeVisible();

  await page.goto('/history');
  const group = page.getByRole('group', { name: '選擇題練習作答紀錄' });
  await group.locator('summary').click();
  const card = group.getByRole('article').first();
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(
    '建築法規與實務・選擇題練習 5 題',
  );
  await expect(card.getByText(/^正確率 (0|100)%$/)).toBeVisible();
  await expect(card.getByText(/^答對 [01]／1 題$/)).toBeVisible();
  await card.getByRole('button', { name: '再做一次' }).click();
  await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
  await expect(page.getByLabel('第 1 題，共 5 題')).toBeVisible();
});

test('the mock exam scores a blank 一律給分 question, as the real exam does', async ({
  page,
}) => {
  // Construction 114 has two 一律給分 questions.
  await page.goto('/practice/mock-exam?subject=construction&year=114');
  await page.getByRole('button', { name: '開始作答' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe(
      '還有 80 題未作答，其中 2 題一律給分仍會計分，其餘不給分。確定要交卷嗎？',
    );
    void dialog.accept();
  });
  await page
    .getByRole('complementary', { name: '試卷資訊' })
    .getByRole('button', { name: /交卷/ })
    .click();
  const result = page.getByRole('region', { name: /構造 114 年模擬考結果/ });
  await expect(result).toContainText('2.50 分／滿分 100 分');
  await expect(result).toContainText(
    '共 80 題，作答 0 題，未作答 80 題；其中 2 題一律給分，計入答對，其餘不給分。',
  );
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
  // Each listed question opens in 歷屆試題（新版）; nothing leads to the old 作答頁.
  await expect(page.locator('a[href^="/exams?question=law-114-"]').first()).toBeVisible();
  expect(await page.locator('a[href*="/questions/"], a[href*="mode="]').count()).toBe(0);
  await page.getByRole('button', { name: '到選擇題練習抽題' }).click();
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
