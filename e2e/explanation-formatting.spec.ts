import { expect, test } from '@playwright/test';
import { createDefaultState, STORAGE_KEY } from '../src/lib/study';

test.use({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL });

test('notes, shared explanations and replies retain whitespace and safe text formatting', async ({ page }, testInfo) => {
  const content = '  第一行 **排版測試重點**\n\n\t第二行  保留空格 !!紅字!!\n最後一行\n';
  const reply = '  回覆縮排\n\n第二段  保留空格';
  const state = createDefaultState();
  state.notes['law-114-01'] = content;
  state.discussionPosts = [{ id: 'formatting-post', questionId: 'law-114-01', type: 'explanation', content, images: [], createdAt: '2026-10-14T00:00:00Z', likes: 0, reported: false, replies: [{ id: 'formatting-reply', content: reply, createdAt: '2026-10-14T00:00:00Z' }] }];
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state });
  await page.goto('/notes?question=law-114-01');
  const note = page.getByRole('region', { name: '已儲存筆記內容' });
  await expect(note.getByText('排版測試重點')).toBeVisible();
  const noteText = note.locator('p > span');
  await expect(noteText).toHaveCSS('white-space', 'pre-wrap');
  expect(await noteText.textContent()).toBe(content.replace('**排版測試重點**', '排版測試重點').replace('!!紅字!!', '紅字'));
  const displayedNote = await noteText.textContent();
  await page.getByRole('button', { name: '分享到考古題討論版', exact: true }).click();
  await expect(page.getByText('已分享到考古題討論版', { exact: true })).toBeVisible();
  await page.goto('/exams?question=law-114-01');
  await page.getByRole('tab', { name: /討論區/ }).click();
  const postText = page.getByText('排版測試重點', { exact: true }).locator('..');
  await expect(postText).toHaveCSS('white-space', 'pre-wrap');
  expect(await postText.textContent()).toBe(displayedNote);
  const replyText = page.getByText(/回覆縮排/).first();
  await expect(replyText).toHaveCSS('white-space', 'pre-wrap');
  expect(await replyText.textContent()).toBe(reply);
  await page.getByRole('button', { name: '編輯', exact: true }).click();
  await expect(page.getByLabel('編輯投稿內容').locator('strong').filter({ hasText: '排版測試重點' })).toHaveText('排版測試重點');
  await expect(page.getByLabel('編輯投稿內容')).not.toContainText('**');
  const edited = '  編輯後第一行\n\n\t下一段  仍保留空格\n';
  await page.getByLabel('編輯投稿內容').fill(edited);
  await page.getByRole('button', { name: '儲存修改' }).click();
  const updated = page.getByText(/編輯後第一行/).first().locator('xpath=ancestor::p[1]');
  await expect(updated.locator(':scope > span')).toHaveCSS('white-space', 'pre-wrap');
  await page.reload();
  expect(await updated.textContent()).toBe(edited);
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport + 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/explanation-formatting-${testInfo.project.name}.png`, fullPage: true });
});
