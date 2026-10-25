import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Question } from '../src/lib/types';

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const paper of [
  { subject: 'construction', year: 114, name: '構造', count: 80 },
  { subject: 'env', year: 113, name: '環控', count: 40 },
]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${paper.name} results fill the content area and adapt to narrow screens in ${theme} mode`, async ({ page, isMobile }, testInfo) => {
      const questions = (JSON.parse(
        await readFile(`public/question-data/${paper.subject}/${paper.year}.json`, 'utf8'),
      ) as Question[]).filter(question => question.format !== 'written' && question.answerKey.kind !== 'written');
      const answers = Object.fromEntries(questions.flatMap((question, index) => {
        if (index % 11 === 0) return [];
        const accepted = question.answerKey.kind === 'accepted' ? question.answerKey.options : [0];
        const selected = index % 7 === 0
          ? question.options.findIndex((_, option) => !accepted.includes(option))
          : accepted[0];
        return [[question.id, selected]];
      }));
      const correct = (question: Question) => question.answerKey.kind === 'all-credit' ||
        (question.answerKey.kind === 'accepted' && question.answerKey.options.includes(answers[question.id]));
      const attempt = {
        id: 'result-layout', mode: 'paper', subject: paper.subject, year: paper.year,
        questionIds: questions.map(question => question.id), answers,
        startedAt: '2026-10-24T00:00:00.000Z', submittedAt: '2026-10-24T01:04:00.000Z', elapsedSeconds: 3840,
        correctCount: questions.filter(correct).length,
        wrongCount: questions.filter(question => answers[question.id] !== undefined && !correct(question)).length,
        unansweredCount: questions.filter(question => answers[question.id] === undefined && !correct(question)).length,
      };
      await page.addInitScript(({ theme, attempt }) => {
        localStorage.setItem('shane-web-theme', theme);
        if (localStorage.getItem('shaneweb:state')) return;
        localStorage.setItem('shaneweb:state', JSON.stringify({
          answers: {}, notes: {}, noteImages: {}, difficultQuestionIds: [],
          discussionPosts: [], likedDiscussionPostIds: [], attempts: [attempt],
        }));
      }, { theme, attempt });
      await page.goto(`/practice/mock-exam?subject=${paper.subject}&year=${paper.year}&result=${attempt.id}`);
      const summary = page.getByRole('region', { name: `${paper.name} ${paper.year} 年模擬考結果`, exact: true });
      const review = page.getByRole('region', { name: '完整作答紀錄', exact: true });
      const navigator = page.getByRole('complementary', { name: '作答結果題號導覽', exact: true });
      await expect(summary).toContainText('01:04:00');
      await expect(navigator.getByRole('link')).toHaveCount(paper.count);

      for (const width of isMobile ? [320, 390, 430, 768] : [1920, 1280, 1100]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const availableWidth = await page.getByRole('main').evaluate(element => {
          const style = getComputedStyle(element);
          return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        });
        expect((await summary.boundingBox())!.width).toBeCloseTo(availableWidth, 0);
        await expectNoHorizontalOverflow(page);
        for (const value of await summary.locator('dd').all()) {
          expect(await value.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        }
        if (availableWidth <= 900) {
          await expect(navigator).toHaveCSS('position', 'static');
          const mapBox = (await navigator.boundingBox())!;
          const reviewBox = (await review.boundingBox())!;
          expect(mapBox.y + mapBox.height).toBeLessThanOrEqual(reviewBox.y);
        } else {
          await expect(navigator).toHaveCSS('position', 'sticky');
          expect((await summary.boundingBox())!.width).toBeGreaterThan(900);
          expect((await navigator.boundingBox())!.x).toBeGreaterThan((await review.boundingBox())!.x);
        }
        if (availableWidth <= 640) {
          for (const button of await summary.getByRole('button').all()) {
            expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          }
        }
        if (availableWidth <= 400) {
          const stats = await summary.locator('dl > div').all();
          const boxes = await Promise.all(stats.map(stat => stat.boundingBox()));
          expect(boxes[0]!.y).toBeCloseTo(boxes[1]!.y, 0);
          expect(boxes[0]!.y).toBeCloseTo(boxes[2]!.y, 0);
          expect(boxes[3]!.y).toBeGreaterThan(boxes[0]!.y);
          await expect(stats[3]).toHaveCSS('border-left-width', '0px');
        }
        await page.screenshot({ path: testInfo.outputPath(`result-${width}.png`) });
      }

      const last = review.locator(`[data-question-id="${questions.at(-1)!.id}"]`);
      await navigator.getByRole('link', { name: new RegExp(`^查看第 ${paper.count} 題結果`) }).click();
      await expect(last).toBeInViewport();
      await last.getByText('檢視完整選項與筆記', { exact: true }).click();
      await expect(last.getByRole('region', { name: `第 ${paper.count} 題完整選項`, exact: true })).toBeVisible();
      await expect(last.getByRole('button', { name: '儲存筆記', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('expanded-review.png') });

      await page.getByRole('tab', { name: '錯題統計結果', exact: true }).click();
      await expect(page.getByRole('heading', { name: '錯題類型統計', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.getByRole('tab', { name: '逐題作答結果', exact: true }).click();
      await expect(navigator.getByRole('link')).toHaveCount(paper.count);
      await page.setViewportSize({ width: isMobile ? 320 : 1920, height: 900 });
      if (theme === 'light') {
        await summary.getByRole('button', { name: '選擇其他試卷', exact: true }).click();
        await expect(page.getByRole('region', { name: '歷屆試題模擬考設定', exact: true })).toBeVisible();
      } else {
        await summary.getByRole('button', { name: '再考一次', exact: true }).click();
        await expect(page).toHaveURL(/&q=1$/);
        await expect(page.getByRole('region', { name: '題目與選項', exact: true })).toBeVisible();
      }
    });
  }
}
