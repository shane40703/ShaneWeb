import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

async function seedPaper(page: Page, subject = 'construction', mode = 'normal', state: 'practice' | 'completed' | 'failed' | 'paper' = 'practice') {
  await page.addInitScript(() => Object.defineProperty(window, 'queryLocalFonts', { value: undefined, configurable: true }));
  const pool = (await Promise.all([114, 113, 112].map(async year =>
    (await page.request.get(`/question-data/${subject}/${year}.json`)).json(),
  ))).flat().filter(question => question.answerKey.kind === 'accepted' && question.answerKey.options.length < question.options.length);
  const ids = pool.slice(0, mode === 'normal' ? 50 : 74).map(question => question.id);
  await page.addInitScript(({ subject, mode, state, ids }) => {
    const key = state === 'paper' ? 'shaneweb:daily-paper' : 'shaneweb:daily-practice';
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({
      rulesVersion: 3, mode, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      subjects: [subject], questionIds: ids, optionOrders: Object.fromEntries(ids.map(id => [id, [2, 0, 3, 1]])),
      answers: state === 'completed' ? Object.fromEntries(ids.map(id => [id, { selected: 0, correct: true }]))
        : state === 'failed' ? Object.fromEntries(ids.slice(0, 7).map(id => [id, { selected: 0, correct: false }])) : {},
      eliminatedOptions: {}, relicUses: {}, protectedWrongIds: [], guardUses: {},
      hp: state === 'failed' ? 0 : 100, currentIndex: state === 'completed' ? ids.length : state === 'failed' ? 7 : 0,
      unreviewedWrongIds: [], reviewedWrongIds: [], status: state === 'paper' ? 'practice' : state,
      failureReason: state === 'failed' ? 'mistakes' : undefined,
    }));
  }, { subject, mode, state, ids });
}

test('completed daily paper previews every question in assigned order, survives reload and includes images', async ({ page }, testInfo) => {
  await seedPaper(page, 'construction', 'normal', 'completed');
  await page.goto('/daily');
  const panel = page.getByRole('region', { name: '當日考題預覽工具' });
  const wrongAnswers = await page.getByRole('region', { name: '本次錯題整理' }).boundingBox();
  const panelBounds = await panel.boundingBox();
  expect(panelBounds!.y).toBeGreaterThanOrEqual(wrongAnswers!.y + wrongAnswers!.height);
  await expect(page.getByRole('button', { name: '列印／下載 PDF' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('completed-preview-below-results.png'), fullPage: true });
  await page.getByRole('button', { name: '當日考題預覽', exact: true }).click();
  const preview = page.getByRole('region', { name: '當日考題預覽', exact: true });
  await expect(preview.locator('article')).toHaveCount(50);
  await expect(preview.locator('img').first()).toBeVisible();
  const source = await (await page.request.get('/question-data/construction/114.json')).json();
  await expect(preview.getByRole('list', { name: '每日第 1 題選項' }).locator('li').first()).toContainText(source[0].options[2]);
  await expect(preview.locator('[data-question-id]').last()).toHaveAttribute('data-question-id', /construction-/);
  await expect(preview.getByText(/正確答案/)).toHaveCount(0);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('preview.png') });
  const size = await preview.evaluate(element => ({ height: element.clientHeight, scroll: element.scrollHeight }));
  expect(size.scroll).toBeLessThanOrEqual(size.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const before = await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'));
  await page.getByRole('button', { name: '收合當日考題' }).click();
  expect(await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'))).toBe(before);
  await page.reload();
  await page.getByRole('button', { name: '當日考題預覽', exact: true }).click();
  await expect(preview.locator('article')).toHaveCount(50);
});

const subjectNames = { law: '建築法規與實務', env: '建築環境控制', construction: '建築構造與施工', structure: '建築結構' };
for (const subject of ['law', 'env', 'construction', 'structure'] as const) {
  test(`${subject} downloads an actual PDF with a reference-answer page without changing progress`, async ({ page }, testInfo) => {
    await seedPaper(page, subject, 'normal', 'paper');
    await page.goto('/daily');
    await page.getByRole('radio', { name: new RegExp(subjectNames[subject]) }).click();
    const button = page.getByRole('button', { name: '製作每日練習紙本檔案' });
    await expect(button).toBeEnabled({ timeout: 20_000 });
    const before = await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'));
    const downloadEvent = page.waitForEvent('download');
    await button.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/^建築師每日練習-.*\.pdf$/);
    const output = testInfo.outputPath(`${subject}.pdf`);
    await download.saveAs(output);
    const bytes = await readFile(output);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe('專門職業及技術人員高等考試建築師每日練習試題');
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    await expect(page.getByRole('status').filter({ hasText: '未取得完整指定字型' })).toContainText('開源明體 Noto Serif TC');
    expect(await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'))).toBe(before);
  });
}

test('normal setup directly downloads a paper without starting online practice, then retains the same assignment after reload', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.defineProperty(window, 'queryLocalFonts', { value: undefined, configurable: true }));
  await page.goto('/daily');
  await expect(page.getByRole('radio', { name: /正常模式/ })).toBeChecked();
  await expect(page.getByRole('button', { name: '建立今日挑戰' })).toHaveCount(0);
  await page.getByRole('radio', { name: /建築構造與施工/ }).click();
  const make = page.getByRole('button', { name: '製作每日練習紙本檔案' });
  await expect(make).toBeEnabled();
  const setup = page.getByRole('region', { name: '每日練習設定' });
  const footer = setup.locator('footer');
  await expect(footer.getByRole('button', { name: '製作每日練習紙本檔案' })).toBeVisible();
  await expect(footer.getByRole('button', { name: '線上作答' })).toBeVisible();
  const subjectBounds = await setup.getByRole('group', { name: '選擇今日科目' }).boundingBox();
  const footerBounds = await footer.boundingBox();
  expect(footerBounds!.y).toBeGreaterThanOrEqual(subjectBounds!.y + subjectBounds!.height);
  expect(await setup.evaluate(element => element.lastElementChild?.tagName)).toBe('FOOTER');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('setup-paper-online.png'), fullPage: true });
  const event = page.waitForEvent('download');
  await make.click();
  const download = await event;
  await download.saveAs(testInfo.outputPath('setup-paper.pdf'));
  await expect(page.getByRole('region', { name: '每日練習設定' })).toBeVisible();
  await expect(page.getByRole('region', { name: '題目與選項' })).toHaveCount(0);
  const cached = await page.evaluate(() => {
    expectNoOnline();
    function expectNoOnline() { if (localStorage.getItem('shaneweb:daily-practice')) throw new Error('paper started online practice'); }
    return JSON.parse(localStorage.getItem('shaneweb:daily-paper')!);
  });
  expect(cached.answers).toEqual({});
  expect(cached.questionIds).toHaveLength(50);
  const rows = await Promise.all([114,113,112,111,110,109,108,107,106,105,104,103,102,101,100].map(async year =>
    (await page.request.get(`/question-data/construction/${year}.json`)).json()));
  const bank = new Map(rows.flat().map(question => [question.id, question]));
  expect(cached.questionIds.every((id: string) => {
    const question = bank.get(id);
    return question?.answerKey.kind === 'accepted' && question.answerKey.options.length < question.options.length;
  })).toBe(true);
  await page.reload();
  await page.getByRole('radio', { name: /建築構造與施工/ }).click();
  await page.getByRole('button', { name: '線上作答' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  await expect(page.getByRole('region', { name: '當日考題預覽工具' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '當日考題預覽' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '列印／下載 PDF' })).toHaveCount(0);
  const active = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!));
  expect(active.questionIds).toEqual(cached.questionIds);
  expect(active.optionOrders).toEqual(cached.optionOrders);
  expect(active.answers).toEqual({});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('PDF loading errors can be retried from setup without starting online practice', async ({ page }) => {
  await seedPaper(page, 'construction', 'normal', 'paper');
  await page.route('**/fonts/daily-paper/paper-ming.ttf', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/daily');
  await page.getByRole('radio', { name: /建築構造與施工/ }).click();
  const button = page.getByRole('button', { name: '製作每日練習紙本檔案' });
  await expect(button).toBeEnabled({ timeout: 20_000 });
  const before = await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'));
  await button.click();
  await expect(page.getByRole('alert').filter({ hasText: '試卷字型或題圖載入失敗' })).toBeVisible();
  await expect(button).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'))).toBe(before);
  await page.unroute('**/fonts/daily-paper/paper-ming.ttf');
  const download = page.waitForEvent('download');
  await button.click();
  await download;
});

for (const mode of ['normal', 'adventure']) {
  test(`${mode} online practice hides paper tools and full preview while playing`, async ({ page }, testInfo) => {
    await seedPaper(page, 'law', mode);
    await page.goto('/daily');
    await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
    await expect(page.getByRole('region', { name: '當日試題工具' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '當日考題預覽工具' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '當日考題預覽' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '列印／下載 PDF' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('online-no-paper-tools.png') });
  });
}

for (const status of ['completed', 'failed'] as const) {
  test(`${status} adventure previews all reserve questions below results without changing progress`, async ({ page }) => {
    await seedPaper(page, 'law', 'adventure', status);
    await page.goto('/daily');
    const panel = page.getByRole('region', { name: '當日考題預覽工具' });
    await expect(panel).toBeVisible();
    const wrongAnswers = await page.getByRole('region', { name: '本次錯題整理' }).boundingBox();
    const panelBounds = await panel.boundingBox();
    expect(panelBounds!.y).toBeGreaterThanOrEqual(wrongAnswers!.y + wrongAnswers!.height);
    const before = await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'));
    await panel.getByRole('button', { name: '當日考題預覽', exact: true }).click();
    await expect(panel.getByRole('region', { name: '當日考題預覽', exact: true }).locator('article')).toHaveCount(74);
    await expect(page.getByRole('button', { name: '列印／下載 PDF' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('shaneweb:daily-practice'))).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}
