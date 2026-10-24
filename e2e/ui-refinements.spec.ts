import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`daily practice uses the full page width while answering in ${theme} mode`, async ({ page, isMobile }, testInfo) => {
    if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(mode => localStorage.setItem('shane-web-theme', mode), theme);
    await page.goto('/practice/quiz');
    const setup = page.getByRole('region', { name: '每日抽題練習設定', exact: true });
    await expect(setup.getByText(/已選 法規・從 \d+ 題中抽 50 題/)).toBeVisible({ timeout: 20_000 });
    const available = await page.locator('main').evaluate(element => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    });
    expect((await setup.boundingBox())!.width).toBeCloseTo(Math.min(available, 1180), 0);

    await setup.getByRole('button', { name: '線上作答', exact: true }).click();
    const quiz = page.getByRole('region', { name: '每日抽題練習作答', exact: true });
    await expect(quiz.getByRole('radio').first()).toBeVisible();
    const quizBox = (await quiz.boundingBox())!;
    expect(quizBox.width).toBeCloseTo(available, 0);
    await expect(quiz.getByRole('button', { name: '交卷', exact: true })).toHaveCount(0);
    await expect(quiz.getByText('目前題目', { exact: true })).toHaveCount(0);
    const questionBox = (await quiz.getByRole('article').boundingBox())!;
    const sidebarBox = (await quiz.getByRole('complementary', { name: '題組資訊', exact: true }).boundingBox())!;
    if (isMobile) {
      expect(sidebarBox.y).toBeGreaterThanOrEqual(questionBox.y + questionBox.height);
      expect(sidebarBox.width).toBeCloseTo(quizBox.width, 0);
    } else {
      expect(sidebarBox.width).toBeCloseTo(264, 0);
      expect(sidebarBox.x + sidebarBox.width).toBeCloseTo(quizBox.x + quizBox.width, 0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`daily-practice-${theme}.png`), fullPage: true });

    page.once('dialog', dialog => dialog.accept());
    await quiz.getByRole('link', { name: '前往第 50 題', exact: true }).click();
    await quiz.getByRole('button', { name: '完成練習', exact: true }).click();
    const result = page.getByRole('region', { name: '法規練習結果', exact: true });
    await expect(result).toBeVisible();
    expect((await result.boundingBox())!.width).toBeCloseTo(Math.min(available, 1180), 0);
    await page.getByRole('button', { name: '重做這組題目', exact: true }).click();
    await expect(quiz).toBeVisible();
    expect((await quiz.boundingBox())!.width).toBeCloseTo(available, 0);
  });

  test(`paper refinements preserve borders, full-width quizzes and cancellable answers in ${theme} mode`, async ({ page, isMobile }, testInfo) => {
    if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript((mode) => {
      localStorage.setItem('shane-web-theme', mode);
      if (!localStorage.getItem('shaneweb:quiz-progress')) {
        localStorage.setItem('shaneweb:quiz-progress', JSON.stringify({ version: 2, scopes: {
          'paper:law:114': {
            'law-114-01': { selected: 1, elapsedSeconds: 12, startedAt: '2026-10-24T00:00:00Z', eliminatedOptions: [2] },
            'law-114-02': { selected: 0, elapsedSeconds: 6, startedAt: '2026-10-24T00:00:00Z' },
          },
        } }));
      }
      if (!localStorage.getItem('shaneweb:state')) {
        localStorage.setItem('shaneweb:state', JSON.stringify({
          answers: {}, difficultQuestionIds: [], notes: {}, noteImages: {}, discussionPosts: [], likedDiscussionPostIds: [],
          attempts: [114, 113].map(year => ({
            id: `ui-${year}`, mode: 'paper', subject: 'law', year,
            questionIds: [`law-${year}-01`], answers: { [`law-${year}-01`]: 0 },
            startedAt: '2026-10-24T00:00:00Z', submittedAt: '2026-10-24T00:00:12Z',
            elapsedSeconds: 12, correctCount: 1, wrongCount: 0, unansweredCount: 0,
          })),
        }));
      }
    }, theme);

    await page.goto('/practice/mock-exam?subject=law&year=114&q=1');
    const quiz = page.getByRole('region', { name: '歷屆試題模擬考作答', exact: true });
    const choices = quiz.getByRole('radiogroup');
    const radios = choices.getByRole('radio');
    await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });
    const available = await page.locator('main').evaluate(element => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    });
    expect((await quiz.boundingBox())!.width).toBeCloseTo(available, 0);
    const grid = await page.locator('body').evaluate(element => ({
      size: getComputedStyle(element).backgroundSize,
      colors: getComputedStyle(element).backgroundImage.match(/rgb\([^)]+\)/g),
    }));
    expect(grid.size.split(',').every(size => size.trim() === '24px 24px')).toBe(true);
    expect(grid.colors).toHaveLength(2);
    expect(grid.colors![0]).toBe(grid.colors![1]);

    const optionRows = choices.locator(':scope > div');
    await expect(optionRows.first()).toHaveCSS('border-top-width', '0px');
    for (const row of await optionRows.all().then(rows => rows.slice(1))) {
      await expect(row).toHaveCSS('border-top-width', '1px');
    }
    await expect(optionRows.last()).toHaveCSS('border-bottom-width', '0px');
    await radios.nth(1).click();
    await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'false');
    await expect(quiz.getByRole('link', { name: '前往第 1 題（未作答）', exact: true })).toBeVisible();
    await radios.first().dblclick();
    await expect(radios.first()).toHaveAttribute('aria-checked', 'false');
    const lastLabel = radios.last().locator('..');
    await lastLabel.click();
    await expect(radios.last()).toHaveAttribute('aria-checked', 'true');
    await lastLabel.click();
    await expect(radios.last()).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(radios.first()).toBeVisible();
    expect(await radios.evaluateAll(elements => elements.every(element => element.getAttribute('aria-checked') === 'false'))).toBe(true);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:quiz-progress')!).scopes['paper:law:114']);
    expect(draft['law-114-01'].selected).toBeUndefined();
    expect(draft['law-114-01'].eliminatedOptions).toEqual([2]);
    expect(draft['law-114-02'].selected).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`mock-${theme}.png`), fullPage: true });

    await page.goto('/exams?question=law-114-01');
    const answerRows = page.getByRole('region', { name: '題目選項', exact: true }).getByRole('listitem');
    await expect(answerRows.first()).toBeVisible();
    await expect(answerRows.first()).toHaveCSS('border-top-width', '0px');
    for (const row of await answerRows.all().then(rows => rows.slice(1))) {
      await expect(row).toHaveCSS('border-top-width', '1px');
    }
    await expect(answerRows.last()).toHaveCSS('border-bottom-width', '0px');

    await page.goto('/history');
    const latest = page.locator('details[aria-label="114 年作答紀錄"]');
    const previous = page.locator('details[aria-label="113 年作答紀錄"]');
    await expect(latest).toBeVisible();
    for (const year of [latest, previous]) {
      await expect(year).toHaveCSS('border-top-width', '1px');
      await expect(year).toHaveCSS('border-bottom-width', '1px');
      await expect(year).toHaveCSS('border-left-width', '1px');
      await expect(year).toHaveCSS('border-right-width', '1px');
    }
    const a = (await latest.boundingBox())!;
    const b = (await previous.boundingBox())!;
    expect(b.y - a.y - a.height).toBeGreaterThanOrEqual(11);
    await latest.locator('summary').click();
    await expect(latest.locator('article').first()).toBeVisible();
    await expect(latest.locator('article').first()).toHaveCSS('border-left-width', '0px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`history-${theme}.png`), fullPage: true });
  });
}
