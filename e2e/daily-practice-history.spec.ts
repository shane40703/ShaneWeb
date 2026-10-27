import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Question } from '../src/lib/types';

async function seedPractice(page: Page, count: number) {
  const questions = (JSON.parse(await readFile('public/question-data/law/114.json', 'utf8')) as Question[])
    .filter(question => question.answerKey.kind === 'accepted' && question.answerKey.options.length > 0 && question.answerKey.options.length < question.options.length)
    .slice(0, count);
  const first = questions[0];
  const protectedAttempt = {
    id: 'protected-paper', mode: 'paper', subject: 'law', year: 114, questionIds: [first.id],
    answers: { [first.id]: first.answerKey.kind === 'accepted' ? first.answerKey.options[0] : 0 },
    startedAt: '2026-10-26T00:00:00Z', submittedAt: '2026-10-26T00:01:00Z', elapsedSeconds: 60,
    correctCount: 1, wrongCount: 0, unansweredCount: 0,
  };
  const legacy = { ...protectedAttempt, id: 'protected-legacy-practice', mode: 'practice', year: null };
  const state = {
    answers: {}, attempts: [protectedAttempt, legacy], notes: { [first.id]: '原有筆記不得刪除' },
    difficultQuestionIds: [first.id], discussionPosts: [], noteImages: {}, likedDiscussionPostIds: [],
  };
  const session = {
    version: 1, id: 'daily-history-test-set', subject: 'law', rangeStart: 114, rangeEnd: 114, category: 'all',
    questionIds: questions.map(question => question.id), optionOrders: {}, answers: {}, drafts: {}, eliminated: {}, elapsedSeconds: {}, currentIndex: count - 1,
  };
  await page.addInitScript(({ state, session }) => {
    if (localStorage.getItem('shaneweb:state')) return;
    localStorage.setItem('shaneweb:state', JSON.stringify(state));
    localStorage.setItem('shaneweb:practice-session', JSON.stringify(session));
  }, { state, session });
  return { questions, protectedAttempt, legacy };
}

async function finish(page: Page, count: number) {
  await page.goto(`/practice/quiz?q=${count}`);
  const quiz = page.getByRole('region', { name: '每日抽題練習作答', exact: true });
  await expect(quiz.getByRole('radio').first()).toBeVisible();
  await quiz.getByRole('radio').first().click();
  await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
  if (count > 1) page.once('dialog', dialog => dialog.accept());
  await quiz.getByRole('button', { name: '完成練習', exact: true }).click();
  await expect(page.getByRole('region', { name: '儲存每日練習履歷', exact: true })).toBeVisible();
}

test('daily practice is opt-in, saves complete content once, and can delete without losing old data', async ({ page }, testInfo) => {
  const { questions, protectedAttempt, legacy } = await seedPractice(page, 3);
  await finish(page, 3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(2);
  await page.getByRole('button', { name: '不記錄此次作答', exact: true }).click();
  await expect(page.getByText(/此次作答未加入履歷/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('recording-choice.png'), fullPage: true });
  await page.getByRole('button', { name: '儲存此次作答', exact: true }).click();
  const historyLink = page.getByRole('link', { name: '查看每日練習履歷', exact: true });
  await expect(historyLink).toBeVisible();
  await expect(page.getByRole('button', { name: '儲存此次作答', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(3);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!));
  const daily = saved.attempts.find((attempt: { id: string }) => attempt.id.startsWith('daily-practice-'));
  expect(daily.questionIds).toEqual(questions.map(question => question.id));
  expect(Object.keys(daily.answers)).toHaveLength(1);
  expect(daily.unansweredCount).toBe(2);
  expect(daily.correctCount + daily.wrongCount).toBe(1);

  await historyLink.click();
  await expect(page).toHaveURL(/\/practice-history$/);
  await expect(page.getByRole('heading', { name: '每日練習履歷', exact: true })).toBeVisible();
  const group = page.getByLabel('每日抽題練習作答紀錄', { exact: true });
  await group.locator('summary').click();
  await expect(group.getByText(/共 3 題・作答 1 題・未作答 2 題/)).toBeVisible();
  await group.getByRole('button', { name: '查看完整作答紀錄（3）', exact: true }).click();
  await expect(group.getByText(questions[0].text, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('saved-daily-history.png'), fullPage: true });

  await group.getByRole('button', { name: '刪除第 1 次紀錄', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await expect(group.getByRole('button', { name: '刪除第 1 次紀錄', exact: true })).toBeVisible();
  await group.getByRole('button', { name: '刪除第 1 次紀錄', exact: true }).click();
  await confirm.getByRole('button', { name: '確認刪除', exact: true }).click();
  await expect(page.getByRole('heading', { name: '還沒有每日練習履歷', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: '還沒有每日練習履歷', exact: true })).toBeVisible();
  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!));
  expect(remaining.attempts).toEqual([protectedAttempt, legacy]);
  expect(remaining.deletedAttemptIds).toContain(daily.id);
  expect(remaining.notes[questions[0].id]).toBe('原有筆記不得刪除');
  expect(remaining.difficultQuestionIds).toEqual([questions[0].id]);
});

for (const decision of ['skip', 'leave'] as const) {
  test(`daily practice ${decision} without saving never creates a record after reload`, async ({ page }) => {
    const { protectedAttempt, legacy } = await seedPractice(page, 1);
    await finish(page, 1);
    if (decision === 'skip') await page.getByRole('button', { name: '不記錄此次作答', exact: true }).click();
    await page.reload();
    await page.goto('/practice-history');
    await expect(page.getByRole('heading', { name: '還沒有每日練習履歷', exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts)).toEqual([protectedAttempt, legacy]);
    await page.getByRole('button', { name: '我的作答存摺', exact: true }).isVisible().then(async visible => {
      if (!visible) await page.getByRole('button', { name: '開啟選單', exact: true }).click();
    });
    await page.getByRole('button', { name: '我的作答存摺', exact: true }).click();
    await expect(page.getByRole('link', { name: '每日練習履歷', exact: true })).toHaveAttribute('aria-current', 'page');
  });
}
