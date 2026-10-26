import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectActionsInViewport(page: Page, footer: Locator) {
  await expect(footer).toHaveCSS('position', 'sticky');
  for (const button of await footer.getByRole('button').all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }
  const box = (await footer.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const kind of ['daily', 'mock'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${kind} keeps its actions reachable without scrolling in ${theme} mode`, async ({ page, isMobile }, testInfo) => {
      if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(mode => {
        localStorage.setItem('shane-web-theme', mode);
        if (!localStorage.getItem('shaneweb:quiz-progress')) {
          localStorage.setItem('shaneweb:quiz-progress', JSON.stringify({ version: 2, scopes: {
            'paper:law:114': { 'law-114-01': { selected: 0, elapsedSeconds: 1, startedAt: '2026-10-25T00:00:00Z' } },
          } }));
        }
        if (localStorage.getItem('shaneweb:practice-session')) return;
        localStorage.setItem('shaneweb:practice-session', JSON.stringify({
          version: 1, id: 'sticky-actions', subject: 'law', rangeStart: 114, rangeEnd: 114, category: 'all',
          questionIds: ['law-114-01', 'law-114-02', 'law-114-03'], optionOrders: {},
          answers: { 'law-114-01': { selected: 0, correct: false } }, drafts: {}, eliminated: {}, elapsedSeconds: {}, currentIndex: 0,
        }));
      }, theme);
      await page.route('**/question-data/law/114.json', async route => {
        const response = await route.fetch();
        const questions = await response.json();
        const question = questions.find((item: { id: string }) => item.id === 'law-114-01');
        const longText = Array.from({ length: 35 }, (_, index) => `第 ${index + 1} 段：長題幹、詳解與筆記都保留完整內容，不把題目限制在內部捲動區。`).join('\n');
        question.text = longText;
        question.content = [{ kind: 'text', text: longText }];
        question.explanation = `${longText}\n**操作列測試詳解結尾**`;
        await route.fulfill({ response, json: questions });
      });

      await page.goto(kind === 'daily' ? '/practice/quiz?q=1' : '/practice/mock-exam?subject=law&year=114&q=1');
      const quiz = page.getByRole('region', { name: kind === 'daily' ? '每日抽題練習作答' : '歷屆試題模擬考作答', exact: true });
      const footer = quiz.getByRole('article').locator(':scope > footer');
      const next = footer.getByRole('button', { name: '下一題', exact: true });
      await expect(next).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect((await quiz.getByRole('article').boundingBox())!.height).toBeGreaterThan(page.viewportSize()!.height);
      await expect(quiz.getByRole('region', { name: '題目與選項', exact: true })).toHaveCSS('max-height', 'none');
      await expectActionsInViewport(page, footer);

      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
      await expectActionsInViewport(page, footer);
      if (kind === 'daily') {
        const explanationEnd = quiz.getByText('操作列測試詳解結尾', { exact: true });
        await explanationEnd.scrollIntoViewIfNeeded();
        expect((await explanationEnd.boundingBox())!.y + (await explanationEnd.boundingBox())!.height).toBeLessThanOrEqual((await footer.boundingBox())!.y);
        const save = quiz.getByRole('button', { name: '儲存筆記', exact: true });
        await save.scrollIntoViewIfNeeded();
        expect((await save.boundingBox())!.y + (await save.boundingBox())!.height).toBeLessThanOrEqual((await footer.boundingBox())!.y);
      }

      if (isMobile) {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await expectActionsInViewport(page, footer);
        for (const button of await footer.getByRole('button').all()) {
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
      await page.screenshot({ path: testInfo.outputPath(`${kind}-actions-${theme}.png`) });
      await next.click();
      await expect(page).toHaveURL(/q=2$/);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expectActionsInViewport(page, footer);
      if (kind === 'daily') {
        const confirm = footer.getByRole('button', { name: '確認答案', exact: true });
        await expect(confirm).toBeDisabled();
        await quiz.getByRole('radio').first().click();
        await confirm.click();
        await expectActionsInViewport(page, footer);
        await footer.getByRole('button', { name: '下一題', exact: true }).click();
        await expect(footer.getByRole('button', { name: '完成練習', exact: true })).toHaveCount(0);
        await expect(confirm).toBeInViewport({ ratio: 1 });
        await expect(confirm).toBeDisabled();
        await quiz.getByRole('radio').first().click();
        await confirm.click();
        await expect(confirm).toHaveCount(0);
        await expect(footer.getByRole('button', { name: '完成練習', exact: true })).toBeInViewport({ ratio: 1 });
      }
    });
  }
}
