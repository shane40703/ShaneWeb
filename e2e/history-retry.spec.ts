import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Question } from '../src/lib/types';

for (const paper of [
  { subject: 'law', year: 114, count: 80 },
  { subject: 'env', year: 113, count: 40 },
]) {
  for (const hasDraft of [false, true]) {
    test(`${paper.subject} ${paper.year} history retry starts the whole paper directly${hasDraft ? ' after confirming replacement' : ''}`, async ({ page }, testInfo) => {
      const questions = JSON.parse(
        await readFile(`public/question-data/${paper.subject}/${paper.year}.json`, 'utf8'),
      ) as Question[];
      const choiceQuestions = questions.filter(question => question.format !== 'written');
      const firstId = choiceQuestions[0].id;
      const scope = `paper:${paper.subject}:${paper.year}`;
      const startedAt = '2026-10-24T00:00:00.000Z';
      const attempt = {
        id: 'completed-paper', mode: 'paper', subject: paper.subject, year: paper.year,
        questionIds: choiceQuestions.map(question => question.id), answers: { [firstId]: 0 },
        startedAt, submittedAt: '2026-10-24T00:01:00.000Z', elapsedSeconds: 60,
        correctCount: 0, wrongCount: 1, unansweredCount: paper.count - 1,
      };
      const otherDraft = {
        'construction-113-01': { selected: 0, elapsedSeconds: 15, startedAt },
      };
      const oldDraft = {
        [firstId]: { selected: 3, eliminatedOptions: [1], elapsedSeconds: 90, startedAt },
        [choiceQuestions[1].id]: { selected: 0, elapsedSeconds: 60, startedAt },
      };
      const dailySession = { version: 1, id: 'other-daily-session' };
      await page.addInitScript(({ attempt, scope, hasDraft, oldDraft, otherDraft, dailySession }) => {
        // Seed once: reload must read the newly started paper, not the old fixture.
        if (localStorage.getItem('shaneweb:state')) return;
        localStorage.setItem('shaneweb:state', JSON.stringify({
          answers: {}, difficultQuestionIds: [], notes: {}, noteImages: {},
          discussionPosts: [], likedDiscussionPostIds: [], attempts: [attempt],
        }));
        localStorage.setItem('shaneweb:quiz-progress', JSON.stringify({
          version: 2,
          scopes: {
            'paper:construction:113': otherDraft,
            ...(hasDraft ? { [scope]: oldDraft } : {}),
          },
        }));
        localStorage.setItem('shaneweb:practice-session', JSON.stringify(dailySession));
      }, { attempt, scope, hasDraft, oldDraft, otherDraft, dailySession });

      await page.goto('/history');
      const year = page.getByRole('group', { name: `${paper.year} 年作答紀錄`, exact: true });
      await year.locator('summary').click();
      const retry = year.getByRole('button', { name: '再做一次', exact: true });
      if (hasDraft) {
        page.once('dialog', dialog => {
          expect(dialog.message()).toContain('已完成的作答紀錄會保留');
          void dialog.dismiss();
        });
        await retry.click();
        await expect(page).toHaveURL(/\/history$/);
        expect(await page.evaluate(scope =>
          JSON.parse(localStorage.getItem('shaneweb:quiz-progress')!).scopes[scope], scope,
        )).toEqual(oldDraft);
        page.once('dialog', dialog => dialog.accept());
      }
      await retry.click();
      await expect(page).toHaveURL(
        new RegExp(`/practice/mock-exam\\?subject=${paper.subject}&year=${paper.year}&q=1$`),
      );
      await expect(page.getByRole('region', { name: '歷屆試題模擬考設定' })).toHaveCount(0);
      const quiz = page.getByRole('region', { name: '題目與選項' });
      await expect(quiz.getByRole('radio').first()).toBeVisible();
      await expect(page.getByLabel(`第 1 題，共 ${paper.count} 題`, { exact: true })).toBeVisible();
      await expect(quiz.getByRole('radio', { checked: true })).toHaveCount(0);
      const stored = await page.evaluate(() => ({
        state: JSON.parse(localStorage.getItem('shaneweb:state')!),
        drafts: JSON.parse(localStorage.getItem('shaneweb:quiz-progress')!).scopes,
        daily: JSON.parse(localStorage.getItem('shaneweb:practice-session')!),
      }));
      expect(Object.keys(stored.drafts[scope])).toEqual([firstId]);
      expect(stored.drafts[scope][firstId].selected).toBeUndefined();
      expect(stored.drafts[scope][firstId].eliminatedOptions).toBeUndefined();
      expect(stored.drafts[scope][firstId].startedAt).not.toBe(startedAt);
      expect(stored.drafts['paper:construction:113']).toEqual(otherDraft);
      expect(stored.state.attempts).toEqual([attempt]);
      expect(stored.daily).toEqual(dailySession);
      expect(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.screenshot({ path: testInfo.outputPath('history-retry.png') });

      // This is a real resumable paper, not just a question URL that redirects to setup.
      await quiz.getByRole('radio').first().click();
      await page.reload();
      await expect(quiz.getByRole('radio').first()).toBeChecked();
      await page.getByRole('button', { name: /下一題/ }).click();
      await expect(page).toHaveURL(/&q=2$/);
      await expect.poll(() => page.evaluate(() =>
        JSON.parse(localStorage.getItem('shaneweb:state')!).attempts.length,
      )).toBe(1);
    });
  }
}
