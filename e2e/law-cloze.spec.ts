import { expect, test } from '@playwright/test';
import { clozeBank, CLOZE_STORAGE_KEY, createClozeSession } from '../src/features/law-cloze/cloze';

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

test('law cloze preserves statute notation, shows full articles and saves progress', async ({ page }, testInfo) => {
  const session = createClozeSession();
  session.order = ['daylight', ...session.order.filter((id) => id !== 'daylight')];
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, { key: CLOZE_STORAGE_KEY, value: session });
  await page.goto('/law-cloze');
  const inputs = page.getByRole('textbox');
  await expect(inputs).toHaveCount(3);
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
  await page.screenshot({ path: `test-results/law-cloze-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page.getByRole('heading', { name: '完整條文・第 41 條' })).toHaveCount(0);
  for (const input of await inputs.all()) await expect(input).toHaveValue('');
});
