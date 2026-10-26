import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Question } from '../src/lib/types';

async function choices(subject: string, year: number) {
  const questions = JSON.parse(await readFile(`public/question-data/${subject}/${year}.json`, 'utf8')) as Question[];
  return questions.filter(question => question.answerKey.kind === 'accepted' &&
    question.answerKey.options.length > 0 && question.answerKey.options.length < question.options.length);
}

for (const source of ['difficult', 'wrong'] as const) {
  test(`${source} starts the entire subject across years, resumes and completes without losing source records`, async ({ page, isMobile }, testInfo) => {
    if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
    const selected = [...(await choices('law', 114)).slice(0, 51), ...(await choices('law', 113)).slice(0, 2)];
    const other = (await choices('env', 113))[0];
    const ids = selected.map(question => question.id);
    const wrongAnswers = Object.fromEntries(selected.map(question => [question.id,
      question.options.findIndex((_, index) => question.answerKey.kind === 'accepted' && !question.answerKey.options.includes(index)),
    ]));
    const state = {
      answers: {}, difficultQuestionIds: [...ids, other.id], notes: {}, noteImages: {}, discussionPosts: [], likedDiscussionPostIds: [],
      attempts: [{
        id: 'original-mistakes', mode: 'practice', subject: 'law', year: null, questionIds: ids, answers: wrongAnswers,
        startedAt: '2026-10-24T00:00:00Z', submittedAt: '2026-10-24T00:01:00Z',
        elapsedSeconds: 60, correctCount: 0, wrongCount: ids.length, unansweredCount: 0,
      }],
    };
    await page.addInitScript(({ state, otherId }) => {
      if (localStorage.getItem('shaneweb:state')) return;
      localStorage.setItem('shaneweb:state', JSON.stringify(state));
      localStorage.setItem('shaneweb:practice-session', JSON.stringify({
        version: 1, id: 'previous-set', subject: 'env', rangeStart: 113, rangeEnd: 113, category: 'all',
        questionIds: [otherId], optionOrders: {}, answers: {}, drafts: { [otherId]: 0 }, eliminated: {}, elapsedSeconds: {}, currentIndex: 0,
      }));
    }, { state, otherId: other.id });

    await page.goto(`/${source}`);
    const label = source === 'difficult' ? '作答本科目所有難題標記' : '作答本科目所有常錯題目';
    const start = page.getByRole('button', { name: label, exact: true });
    await expect(start).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText('跨所有年度・共 53 題選擇題', { exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.dismiss());
    await start.click();
    await expect(page).toHaveURL(new RegExp(`/${source}$`));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!).id)).toBe('previous-set');

    page.once('dialog', dialog => dialog.accept());
    await start.click();
    await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
    const quiz = page.getByRole('region', { name: '每日抽題練習作答', exact: true });
    await expect(quiz.getByRole('radio').first()).toBeVisible();
    await expect(page.getByLabel('第 1 題，共 53 題', { exact: true })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!));
    expect(stored.questionIds).toEqual(ids);
    expect(stored.reviewSource).toBe(source);
    expect(stored.drafts).toEqual({});
    await expect(quiz.getByRole('button', { name: '交卷', exact: true })).toHaveCount(0);
    await expect(quiz.getByText('目前題目', { exact: true })).toHaveCount(0);

    await quiz.getByRole('radio').first().click();
    await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
    await expect(quiz.getByRole('status')).toContainText(/答對了|答錯了/);
    await quiz.getByRole('link', { name: /^前往第 53 題/ }).click();
    await page.reload();
    await expect(page.getByLabel('第 53 題，共 53 題', { exact: true })).toBeVisible();
    await expect(quiz.getByText(source === 'difficult' ? '本科目難題重練' : '本科目錯題重練', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`${source}-review.png`), fullPage: true });

    page.once('dialog', dialog => dialog.accept());
    await expect(quiz.getByRole('button', { name: '完成練習', exact: true })).toHaveCount(0);
    await quiz.getByRole('radio').first().click();
    await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
    await quiz.getByRole('button', { name: '完成練習', exact: true }).click();
    await expect(page.getByRole('region', { name: '法規練習結果', exact: true })).toBeVisible();
    await expect(page.getByText('共 53 題，作答 2 題，未作答 51 題不計入正確率。', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(2);
    const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!));
    expect(savedState.difficultQuestionIds).toEqual(state.difficultQuestionIds);
    expect(savedState.attempts.find((attempt: { id: string }) => attempt.id === 'original-mistakes').answers).toEqual(wrongAnswers);
    expect(savedState.attempts[0].questionIds).toEqual(ids);
    expect(Object.keys(savedState.attempts[0].answers)).toHaveLength(2);
  });
}
