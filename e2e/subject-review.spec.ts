import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { Question } from '../src/lib/types';

async function choices(subject: string, year: number) {
  const questions = JSON.parse(await readFile(`public/question-data/${subject}/${year}.json`, 'utf8')) as Question[];
  return questions.filter(question => question.answerKey.kind === 'accepted' &&
    question.answerKey.options.length > 0 && question.answerKey.options.length < question.options.length);
}

const scenarios = (['difficult', 'wrong'] as const).flatMap(source =>
  (['all', 'custom'] as const).map(countMode => ({ source, countMode })),
);
for (const { source, countMode } of scenarios) {
  test(`${source} configures ${countMode} questions, shows shared explanations and preserves source records`, async ({ page, isMobile }, testInfo) => {
    if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
    const selected = [...(await choices('law', 114)).slice(0, 51), ...(await choices('law', 113)).slice(0, 2)];
    const other = (await choices('env', 113))[0];
    const ids = selected.map(question => question.id);
    const total = countMode === 'all' ? ids.length : 7;
    const sharedImage = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#acf' } }).png().toBuffer();
    const wrongAnswers = Object.fromEntries(selected.map(question => [question.id,
      question.options.findIndex((_, index) => question.answerKey.kind === 'accepted' && !question.answerKey.options.includes(index)),
    ]));
    const state = {
      answers: {}, difficultQuestionIds: [...ids, other.id], notes: {}, noteImages: {}, discussionPosts: [{
        id: `shared-${source}`, questionId: ids[0], type: 'explanation', content: '**共享解題重點**，這題有使用者分享的詳解。',
        images: [{ id: 'shared-image', name: '共享詳解附圖', type: 'image/png', dataUrl: `data:image/png;base64,${sharedImage.toString('base64')}` }],
        createdAt: '2026-10-27T00:00:00Z', likes: 0, replies: [], reported: false,
      }], likedDiscussionPostIds: [],
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
    const label = source === 'difficult' ? '練習本科目難題標記' : '練習本科目常錯題目';
    const start = page.getByRole('button', { name: label, exact: true });
    await expect(start).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText('跨所有年度・共 53 題選擇題', { exact: true })).toBeVisible();
    const summary = page.getByText(source === 'difficult' ? '查看選項、作答與詳解' : '查看選項、重新作答與詳解', { exact: true }).first();
    await summary.click();
    const explanation = page.getByRole('region', { name: `第 ${selected[0].questionNumber} 題詳解`, exact: true });
    await expect(explanation.getByText('共享解題重點', { exact: true })).toBeVisible();
    await expect(explanation.getByRole('img', { name: '共享詳解附圖' })).toBeVisible();
    await expect(explanation.getByText('目前尚無詳解。', { exact: true })).toHaveCount(0);
    await summary.click();
    await start.click();
    const settings = page.getByRole('dialog', { name: source === 'difficult' ? '難題標記重練設定' : '常錯題目重練設定' });
    await expect(settings.getByRole('spinbutton', { name: '本次題數' })).toHaveValue('50');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!).id)).toBe('previous-set');
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    await expect(start).toBeFocused();
    await start.click();
    page.once('dialog', dialog => dialog.dismiss());
    await settings.getByRole('button', { name: /^開始練習/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${source}$`));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!).id)).toBe('previous-set');

    if (countMode === 'all') {
      await settings.getByRole('button', { name: '全部（53 題）', exact: true }).click();
    } else {
      await settings.getByRole('spinbutton', { name: '本次題數' }).fill('54');
      await expect(settings.getByRole('button', { name: /^開始練習/ })).toBeDisabled();
      await expect(settings.getByRole('alert')).toHaveText('請輸入 1～53 的整數題數。');
      await settings.getByRole('spinbutton', { name: '本次題數' }).fill('7');
    }
    page.once('dialog', dialog => dialog.accept());
    await settings.getByRole('button', { name: `開始練習（${total} 題）`, exact: true }).click();
    await expect(page).toHaveURL(/\/practice\/quiz\?q=1$/);
    const quiz = page.getByRole('region', { name: '每日抽題練習作答', exact: true });
    await expect(quiz.getByRole('radio').first()).toBeVisible();
    await expect(page.getByLabel(`第 1 題，共 ${total} 題`, { exact: true })).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!));
    if (countMode === 'all') expect(stored.questionIds).toEqual(ids);
    else {
      expect(stored.questionIds).toHaveLength(total);
      expect(new Set(stored.questionIds).size).toBe(total);
      expect(stored.questionIds.every((id: string) => ids.includes(id))).toBe(true);
    }
    expect(stored.reviewSource).toBe(source);
    expect(stored.drafts).toEqual({});
    await expect(quiz.getByRole('button', { name: '交卷', exact: true })).toHaveCount(0);
    await expect(quiz.getByText('目前題目', { exact: true })).toHaveCount(0);

    await quiz.getByRole('radio').first().click();
    await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
    await expect(quiz.getByRole('status')).toContainText(/答對了|答錯了/);
    await quiz.getByRole('link', { name: new RegExp(`^前往第 ${total} 題`) }).click();
    await page.reload();
    await expect(page.getByLabel(`第 ${total} 題，共 ${total} 題`, { exact: true })).toBeVisible();
    await expect(quiz.getByText(source === 'difficult' ? '本科目難題重練' : '本科目錯題重練', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`${source}-${countMode}-review.png`), fullPage: true });

    page.once('dialog', dialog => dialog.accept());
    await expect(quiz.getByRole('button', { name: '完成練習', exact: true })).toHaveCount(0);
    await quiz.getByRole('radio').first().click();
    await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
    await quiz.getByRole('button', { name: '完成練習', exact: true }).click();
    await expect(page.getByRole('region', { name: '法規練習結果', exact: true })).toBeVisible();
    await expect(page.getByText(`共 ${total} 題，作答 2 題，未作答 ${total - 2} 題不計入正確率。`, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length)).toBe(2);
    const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!));
    expect(savedState.difficultQuestionIds).toEqual(state.difficultQuestionIds);
    expect(savedState.attempts.find((attempt: { id: string }) => attempt.id === 'original-mistakes').answers).toEqual(wrongAnswers);
    expect(savedState.attempts[0].questionIds).toEqual(stored.questionIds);
    expect(Object.keys(savedState.attempts[0].answers)).toHaveLength(2);
  });
}
