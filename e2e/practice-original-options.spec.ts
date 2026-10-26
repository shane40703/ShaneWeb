import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Question } from '../src/lib/types';

for (const shuffled of [true, false]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${shuffled ? 'shuffled' : 'original'} daily options show original letters only after confirmation in ${theme}`, async ({ page, isMobile }, testInfo) => {
      if (!isMobile) await page.setViewportSize({ width: 1440, height: 1000 });
      const questions = JSON.parse(await readFile('public/question-data/law/114.json', 'utf8')) as Question[];
      const question = questions.find(item => item.options.length === 4 && item.answerKey.kind === 'accepted' && item.answerKey.options.length < 4)!;
      if (question.answerKey.kind !== 'accepted') throw new Error('Expected a graded question');
      const order = shuffled ? [2, 0, 3, 1] : [0, 1, 2, 3];
      const wrongOriginal = question.options.findIndex((_, index) => question.answerKey.kind === 'accepted' && !question.answerKey.options.includes(index));
      const selected = order.indexOf(wrongOriginal);
      const explanation = '詳解仍引用原題選項 A、B、C、D，內容不隨打亂的順序改寫。';
      await page.route('**/question-data/law/114.json', async route => {
        await route.fulfill({ json: questions.map(item => item.id === question.id ? { ...item, explanation } : item) });
      });
      await page.addInitScript(({ id, order, shuffled, theme }) => {
        localStorage.setItem('shane-web-theme', theme);
        if (localStorage.getItem('shaneweb:practice-session')) return;
        localStorage.setItem('shaneweb:practice-session', JSON.stringify({
          version: 1, id: 'original-options-test', subject: 'law', rangeStart: 114, rangeEnd: 114, category: 'all',
          questionIds: [id], optionOrders: shuffled ? { [id]: order } : {},
          answers: {}, drafts: {}, eliminated: {}, elapsedSeconds: {}, currentIndex: 0,
        }));
      }, { id: question.id, order, shuffled, theme });
      await page.goto('/practice/quiz?q=1');
      const quiz = page.getByRole('region', { name: '每日抽題練習作答', exact: true });
      const options = quiz.getByRole('radiogroup');
      await expect(options.getByRole('radio')).toHaveCount(4);
      await expect(options.getByText(/原選項 [A-D]/)).toHaveCount(0);
      await options.getByRole('radio').nth(selected).click();
      await expect(options.getByText(/原選項 [A-D]/)).toHaveCount(0);
      await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
      await expect(quiz.getByRole('status')).toContainText('答錯了');
      await expect(quiz.getByText(explanation, { exact: true })).toBeVisible();
      if (isMobile) await page.setViewportSize({ width: 320, height: 740 });
      const expected = order.map(index => `（原選項 ${String.fromCharCode(65 + index)}）`);
      for (const [index, original] of order.entries()) {
        const row = options.locator('label').nth(index);
        await expect(row).toContainText(question.options[original]);
        if (shuffled) {
          const marker = row.getByText(expected[index], { exact: true });
          await expect(marker).toBeVisible();
          const appearance = await marker.evaluate(element => ({
            color: getComputedStyle(element).color,
            size: parseFloat(getComputedStyle(element).fontSize),
            optionColor: getComputedStyle(element.parentElement!).color,
            optionSize: parseFloat(getComputedStyle(element.parentElement!).fontSize),
          }));
          expect(appearance.color).not.toBe(appearance.optionColor);
          expect(appearance.size).toBeLessThan(appearance.optionSize);
        }
      }
      await expect(options.getByText(/原選項 [A-D]/)).toHaveCount(shuffled ? 4 : 0);
      if (isMobile) {
        await options.evaluate(element => (element as HTMLElement).style.setProperty('--option-font-size', '32px'));
        await expect(options.locator('label').first()).toHaveCSS('font-size', '32px');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.screenshot({ path: testInfo.outputPath('original-option-references.png'), fullPage: true });

      await page.reload();
      await expect(options.getByText(/原選項 [A-D]/)).toHaveCount(shuffled ? 4 : 0);
      await expect(quiz.getByRole('status')).toContainText('答錯了');
      await quiz.getByRole('button', { name: '完成練習', exact: true }).click();
      const review = page.getByRole('region', { name: '本次錯題整理', exact: true });
      await expect(review.getByText(/原選項 [A-D]/)).toHaveCount(shuffled ? 4 : 0);
      if (shuffled) expect(await review.getByText(/原選項 [A-D]/).allTextContents()).toEqual(expected);
      await expect(review.getByText(explanation, { exact: true })).toBeVisible();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!));
      expect(saved.attempts[0].answers[question.id]).toBe(wrongOriginal);
      expect(saved.attempts[0].wrongCount).toBe(1);
      expect(JSON.stringify(saved.attempts[0])).not.toContain('原選項');
      await page.getByRole('button', { name: '重做這組題目', exact: true }).click();
      await expect(options.getByText(/原選項 [A-D]/)).toHaveCount(0);
    });
  }
}
