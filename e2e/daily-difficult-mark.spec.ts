import { expect, test } from '@playwright/test';

test('a mark from daily practice appears in the passbook and survives reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('shaneweb:state')) return;
    localStorage.setItem('shaneweb:state', JSON.stringify({
      difficultQuestionIds: ['law-113-01'],
      notes: { 'law-113-01': '既有筆記' },
    }));
    localStorage.setItem('shaneweb:practice-session', JSON.stringify({
      version: 1, id: 'mark-test', subject: 'law', rangeStart: 114, rangeEnd: 114,
      category: 'all', questionIds: ['law-114-01'], optionOrders: {}, answers: {},
      drafts: {}, eliminated: {}, elapsedSeconds: {}, currentIndex: 0,
    }));
  });
  await page.goto('/practice/quiz?q=1');
  await page.getByRole('button', { name: '標記為難題', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消難題標記', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('shaneweb:state')!).difficultQuestionIds,
  )).toEqual(['law-113-01', 'law-114-01']);

  await page.goto('/difficult');
  await expect(page.getByRole('heading', { name: /114 年/ })).toBeVisible();
  await expect(page.getByRole('region', { name: /114 年/ })).toContainText('第 1 題');
  await page.reload();
  await expect(page.getByRole('region', { name: /114 年/ })).toContainText('第 1 題');
  await page.getByRole('button', { name: '取消難題標記', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('shaneweb:state')!).difficultQuestionIds,
  )).toEqual(['law-113-01']);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!));
  expect(state.difficultPendingChanges).toEqual({ 'law-114-01': false });
  expect(state.notes['law-113-01']).toBe('既有筆記');
});
