import { expect, test } from '@playwright/test';
import { clozeBank, CLOZE_STORAGE_KEY, createClozeSession } from '../src/features/law-cloze/cloze';

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

test('law cloze preserves statute notation, shows full articles and saves progress', async ({ page }, testInfo) => {
  const session = createClozeSession({ count: 5 });
  session.order = ['daylight', 'underground', 'a-ramp-slope', 'a-stair-step', 'a-motorcycle'];
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, { key: CLOZE_STORAGE_KEY, value: session });
  await page.goto('/law-cloze');
  const inputs = page.getByRole('textbox');
  await expect(inputs).toHaveCount(3);
  await expect(page.locator('[aria-label="填空條文節錄"] input')).toHaveCount(3);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('法規克漏字');
  await expect(page.getByRole('heading', { name: '完整條文・第 41 條' })).toHaveCount(0);
  // Fill a later blank first to exercise partial-draft restoration.
  await inputs.nth(2).fill('75');
  await page.reload();
  await expect(inputs.nth(2)).toHaveValue('75');
  await inputs.nth(0).fill('1/5');
  await inputs.nth(1).fill('0.125');
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('status')).toHaveText('本題答對 2 / 3 空');
  const question = clozeBank.questions.find((q) => q.id === 'daylight')!;
  await expect(page.locator('pre')).toHaveText(question.fullText);
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('本題答對 2 / 3 空');
  await expect(inputs.nth(1)).toHaveValue('0.125');
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
  const answerColor = await page.locator('pre strong').first().evaluate((el) => getComputedStyle(el).color);
  const normalColor = await page.locator('pre').evaluate((el) => getComputedStyle(el).color);
  expect(answerColor).not.toEqual(normalColor);
  await page.screenshot({ path: `test-results/law-cloze-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page.getByRole('heading', { name: '完整條文・第 41 條' })).toHaveCount(0);
  for (const input of await inputs.all()) await expect(input).toHaveValue('');
  // Finish the requested five-question round and verify each new statute's answers.
  for (const id of session.order.slice(1)) {
    const q = clozeBank.questions.find((q) => q.id === id)!;
    await expect(page.getByRole('heading', { name: q.title, exact: true })).toBeVisible();
    if (id === 'underground') await expect(page.locator('[aria-label="填空條文節錄"]')).toContainText('三、地下通道及地下廣場');
    for (const [i, blank] of q.blanks.entries()) await page.getByRole('textbox', { name: `第 ${i + 1} 空：${blank.label}`, exact: true }).first().fill(blank.answer);
    await page.getByRole('button', { name: '提交答案' }).click();
    await expect(page.locator('pre')).toHaveText(q.fullText);
    if (id !== 'a-motorcycle') await page.getByRole('button', { name: '下一題' }).click();
  }
  await expect(page.getByRole('heading', { name: '本輪測驗完成' })).toBeVisible();
  await expect(page.getByText(/5 題中 4 題全對/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '本輪測驗完成' })).toBeVisible();
  await page.getByRole('button', { name: '再練一輪' }).click();
  await expect(page.getByRole('heading', { name: '本輪測驗完成' })).toHaveCount(0);
});

test('law/count/category selections start a new round and disclose small pools', async ({ page }, testInfo) => {
  await page.goto('/law-cloze');
  await page.getByRole('combobox', { name: '法規', exact: true }).selectOption('accessibility');
  await page.getByRole('combobox', { name: '每次測驗題數' }).selectOption('30');
  await page.getByRole('button', { name: '開始新測驗' }).click();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).order.length, CLOZE_STORAGE_KEY)).toBe(30);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), CLOZE_STORAGE_KEY);
  expect(new Set(state.order).size).toBe(30);
  expect(state.order.every((id: string) => clozeBank.questions.find((q) => q.id === id)?.lawId === 'accessibility')).toBe(true);
  await page.reload();
  await expect(page.getByRole('combobox', { name: '每次測驗題數' })).toHaveValue('30');
  await page.getByRole('combobox', { name: '考點', exact: true }).selectOption('無障礙客房');
  await expect(page.getByText(/此考點題數不足/)).toContainText('新測驗將抽 1 題');
  await page.getByRole('button', { name: '開始新測驗' }).click();
  await expect(page.getByRole('heading', { name: '客房衛浴與房內通路' })).toBeVisible();
  await page.screenshot({ path: `test-results/law-cloze-inline-${testInfo.project.name}.png`, fullPage: true });
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
});

test('repeated thresholds synchronize the same inline blank', async ({ page }) => {
  const session = createClozeSession({ count: 5 });
  session.order = ['fire-area', ...session.order.filter((id) => id !== 'fire-area')].slice(0, 5);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: CLOZE_STORAGE_KEY, value: session });
  await page.goto('/law-cloze');
  const q = clozeBank.questions.find((q) => q.id === 'fire-area')!;
  for (const [i, blank] of q.blanks.entries()) {
    const fields = page.getByRole('textbox', { name: `第 ${i + 1} 空：${blank.label}`, exact: true });
    await fields.first().fill(blank.answer);
    for (const input of await fields.all()) await expect(input).toHaveValue(blank.answer);
  }
  await page.getByRole('button', { name: '提交答案' }).click();
  await expect(page.getByRole('status')).toHaveText('本題答對 3 / 3 空');
});

test('bank expansion keeps the previous saved two-question underground round', async ({ page }) => {
  const session = createClozeSession({ lawId: 'design-construction', category: '地下建築', count: 30 });
  session.version = clozeBank.legacyVersion;
  session.order = ['underground', 'underground-stair'];
  session.answers = ['6', '1:12', '3'];
  session.results.underground = [...session.answers];
  session.submitted = true;
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, { key: CLOZE_STORAGE_KEY, value: session });
  await page.goto('/law-cloze');
  await expect(page.getByRole('heading', { name: '地下通道尺寸' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('本題答對 3 / 3 空');
  await expect(page.getByRole('note')).toContainText('保留先前的 2 題順序、草稿與成績');
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('本題答對 3 / 3 空');
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), CLOZE_STORAGE_KEY);
  expect(before.order).toEqual(session.order);
  expect(before.answers).toEqual(session.answers);
  await page.getByRole('button', { name: '開始新測驗' }).click();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).version, CLOZE_STORAGE_KEY)).toBe(clozeBank.version);
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), CLOZE_STORAGE_KEY);
  expect(after.order.length).toBeGreaterThan(2);
  expect(after.order.some((id: string) => id.startsWith('d-'))).toBe(true);
  expect(after.results).toEqual({});
  await expect(page.getByRole('note')).toHaveCount(0);
});

test('expanded construction topics support inline notation and exact red original answers', async ({ page }, testInfo) => {
  const session = createClozeSession({ lawId: 'design-construction', count: 5 });
  session.order = ['d-windowless-definition', 'd-shadow-height', 'd-slope-retaining', 'd-highrise-drift', 'd-detention'];
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: CLOZE_STORAGE_KEY, value: session });
  await page.goto('/law-cloze');
  for (const id of session.order) {
    const q = clozeBank.questions.find((q) => q.id === id)!;
    await expect(page.getByRole('heading', { name: q.title, exact: true })).toBeVisible();
    for (const [i, blank] of q.blanks.entries()) await page.getByRole('textbox', { name: `第 ${i + 1} 空：${blank.label}`, exact: true }).first().fill(blank.answer);
    await page.getByRole('button', { name: '提交答案' }).click();
    await expect(page.getByRole('status')).toContainText(`本題答對 ${q.blanks.length} / ${q.blanks.length} 空`);
    await expect(page.locator('pre')).toHaveText(q.fullText);
    const highlighted = await page.locator('pre strong').allTextContents();
    expect(highlighted).toEqual(q.answerRanges.map((range) => q.fullText.slice(range.start, range.end)));
    if (id === 'd-shadow-height') {
      const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
      expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `test-results/law-cloze-expanded-${testInfo.project.name}.png`, fullPage: true });
    }
    if (id !== 'd-detention') await page.getByRole('button', { name: '下一題' }).click();
  }
  await expect(page.getByRole('heading', { name: '本輪測驗完成' })).toBeVisible();
  await expect(page.getByText(/5 題中 5 題全對/)).toBeVisible();
});
