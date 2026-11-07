import { expect, test } from '@playwright/test';

for (const mode of ['daily', 'mock'] as const) {
  test(`${mode} supports arrows, Space, and submission without stealing editor keys`, async ({ page, isMobile }) => {
    if (!isMobile) await page.setViewportSize({ width: 1600, height: 1000 });
    await page.addInitScript(() => {
      localStorage.setItem('shaneweb:practice-session', JSON.stringify({
        version: 1, id: 'keyboard', subject: 'law', rangeStart: 114, rangeEnd: 114, category: 'all',
        questionIds: ['law-114-01'], optionOrders: {}, answers: {}, drafts: { 'law-114-01': 0 },
        eliminated: {}, elapsedSeconds: {}, currentIndex: 0,
      }));
      localStorage.setItem('shaneweb:quiz-progress', JSON.stringify({ version: 2, scopes: {
        'paper:law:114': { 'law-114-01': { selected: 0, elapsedSeconds: 1, startedAt: '2026-11-07T00:00:00Z' } },
      } }));
    });
    await page.goto(mode === 'daily' ? '/practice/quiz?q=1' : '/practice/mock-exam?subject=law&year=114&q=1');
    const question = page.getByRole('region', { name: '題目與選項', exact: true });
    await expect(question).toBeVisible();
    const radios = question.getByRole('radio');
    await radios.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(radios.nth(1)).toBeChecked();
    await page.keyboard.press('Space');
    await expect(question.getByRole('button', { name: '恢復選項 B' })).toBeVisible();
    await expect(radios.nth(1)).not.toBeChecked();
    await expect(radios.nth(1)).toBeDisabled();
    await page.keyboard.press('Space');
    await expect(question.getByRole('button', { name: '刪去選項 B' })).toBeVisible();
    await expect(radios.nth(1)).toBeEnabled();
    await expect(radios.nth(1)).not.toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(radios.first()).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: `/private/tmp/quiz-keyboard-${mode}-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.keyboard.press('ControlOrMeta+Enter');
    if (mode === 'daily') {
      const complete = page.getByRole('button', { name: '完成練習', exact: true });
      await expect(complete).toBeVisible();
      const editor = page.getByRole('textbox', { name: /筆記/ });
      await editor.fill('A');
      await editor.press('End');
      await editor.press('Space');
      await editor.press('B');
      await expect(editor).toContainText('A B');
      await editor.press('ControlOrMeta+Enter');
      await expect(complete).toBeVisible();
      await complete.focus();
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(page.getByText('法規練習結果', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('alertdialog', { name: '確定要交卷嗎？' })).toBeVisible();
    }
  });
}
