import { expect, test, type Locator, type Page } from '@playwright/test';

async function selectAll(editor: Locator) {
  await editor.click();
  await editor.press('ControlOrMeta+a');
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}
async function placeholderContent(editor: Locator) {
  return editor.evaluate(element => getComputedStyle(element, '::before').content);
}

for (const theme of ['light', 'dark'] as const) {
  test(`visual notes keep live styles, toggles, selection, history, persistence and sharing in ${theme}`, async ({ page, isMobile }, testInfo) => {
    await page.addInitScript(theme => { localStorage.setItem('shane-web-theme', theme); }, theme);
    await page.goto('/notes?question=law-114-01');
    const editor = page.getByRole('textbox', { name: '我的筆記', exact: true });
    const format = (label: string) => page.getByRole('button', { name: `切換選取文字的${label}格式`, exact: true });
    await expect(editor).toBeVisible();
    await expect.poll(() => placeholderContent(editor)).toContain('記下法條');
    await editor.fill('建築物 0.75m2 即時筆記');
    await expect.poll(() => placeholderContent(editor)).toBe('none');
    await selectAll(editor);
    await format('粗體').click();
    await expect(format('粗體')).toHaveAttribute('aria-pressed', 'true');
    await expect(editor.locator('strong')).toHaveText('建築物 0.75m2 即時筆記');
    await format('粗體').click();
    await expect(editor.locator('strong')).toHaveCount(0);
    await expect(format('粗體')).toHaveAttribute('aria-pressed', 'false');
    await format('粗體').click();
    await format('底線').click();
    await page.getByRole('combobox', { name: '文字顏色', exact: true }).selectOption('var(--danger)');
    await page.getByRole('combobox', { name: '文字大小', exact: true }).selectOption('24px');
    await expect(editor.locator('[style*="font-size"]')).toHaveCSS('font-size', '24px');
    await format('粗體').click();
    await expect(editor.locator('strong')).toHaveCount(0);
    await expect(editor.locator('[style*="color"]')).toHaveCSS('font-weight', '400');
    await format('粗體').click();
    await expect(editor.locator('u')).toContainText('即時筆記');
    await expect(editor).not.toContainText('**');
    await page.getByLabel('自訂文字顏色', { exact: true }).fill('#123abc');
    await expect(editor.locator('[style*="color"]')).toHaveCSS('color', 'rgb(18, 58, 188)');
    await noOverflow(page);
    if (isMobile) {
      await page.setViewportSize({ width: 320, height: 700 });
      await noOverflow(page);
      for (const control of [format('粗體'), page.getByRole('combobox', { name: '文字大小', exact: true })]) {
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.screenshot({ path: testInfo.outputPath('live-editor.png') });
    await page.getByRole('button', { name: '儲存筆記', exact: true }).click();
    const saved = page.getByRole('region', { name: '已儲存筆記內容', exact: true });
    await expect(saved.locator('strong')).toContainText('即時筆記');
    await expect(saved.locator('[style]')).toHaveCSS('font-size', '24px');
    await expect(saved.locator('[style]')).toHaveCSS('color', 'rgb(18, 58, 188)');
    await page.reload();
    await expect(saved.locator('u')).toContainText('即時筆記');
    await page.getByRole('button', { name: '編輯筆記', exact: true }).click();
    await expect(editor.locator('strong')).toContainText('即時筆記');
    // Opening saved content must hide the hint before any click/focus in the editor.
    await expect.poll(() => placeholderContent(editor)).toBe('none');
    await selectAll(editor);
    await page.getByRole('button', { name: '清除格式', exact: true }).click();
    await expect(editor.locator('strong, u, [style]')).toHaveCount(0);
    await page.getByRole('button', { name: '復原', exact: true }).click();
    await expect(editor.locator('strong')).toContainText('即時筆記');
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await expect(editor.locator('strong')).toHaveCount(0);

    // Apply red plus superscript only to the exponent, without moving other text.
    await editor.fill('0.75m2');
    await editor.press('Shift+ArrowLeft');
    await format('上標').click();
    await page.getByRole('combobox', { name: '文字顏色', exact: true }).selectOption('var(--danger)');
    await expect(editor.locator('sup')).toHaveText('2');
    await expect(editor).toHaveText('0.75m2');
    await page.getByRole('button', { name: '儲存筆記', exact: true }).click();
    await expect(saved.locator('sup')).toHaveText('2');
    await page.getByRole('button', { name: '分享到考古題討論版', exact: true }).click();
    await expect(page.getByText('已分享到考古題討論版', { exact: true })).toBeVisible();
    await page.goto('/exams?question=law-114-01');
    const post = page.locator('article').filter({ has: page.locator('sup', { hasText: '2' }) }).first();
    await expect(post).toContainText('0.75m2');
    await post.getByRole('button', { name: '編輯', exact: true }).click();
    const postEditor = page.getByRole('textbox', { name: '編輯投稿內容', exact: true });
    await expect(postEditor.locator('sup')).toHaveText('2');
    await expect(postEditor).not.toContainText('shaneweb:richtext');
    await postEditor.fill('共享內容保留可見編輯');
    await page.getByRole('button', { name: '儲存修改', exact: true }).click();
    await expect(postEditor).toHaveCount(0);
    const updatedPost = page.getByText('共享內容保留可見編輯', { exact: true }).locator('xpath=ancestor::article[1]');
    await updatedPost.getByRole('button', { name: '加入我的筆記', exact: true }).click();
    await page.goto('/notes?question=law-114-01');
    await expect(saved).toContainText('0.75m2');
    await expect(saved).toContainText('共享內容保留可見編輯');
    await expect(saved.locator('sup')).toHaveText('2');
    await noOverflow(page);
  });
}

test('result disclosures initialize notes lazily and preserve a collapsed unsaved draft', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shaneweb:state', JSON.stringify({ attempts: [{
      id: 'rich-review', mode: 'paper', subject: 'law', year: 114,
      questionIds: Array.from({ length: 80 }, (_, index) => `law-114-${String(index + 1).padStart(2, '0')}`),
      answers: {}, startedAt: '2026-10-25T00:00:00Z', submittedAt: '2026-10-25T00:01:00Z',
      elapsedSeconds: 60, correctCount: 0, wrongCount: 0, unansweredCount: 80,
    }], notes: { 'law-114-01': '**舊筆記** !!0.75m^2^!!' } }));
  });
  await page.goto('/practice/mock-exam?subject=law&year=114&result=rich-review');
  await expect(page.getByRole('region', { name: '完整作答紀錄', exact: true })).toBeVisible();
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
  const row = page.locator('#result-question-law-114-01');
  const summary = row.getByText('檢視完整選項與筆記', { exact: true });
  await summary.click();
  const editor = row.getByRole('textbox', { name: '第 1 題筆記內容', exact: true });
  await expect(editor.locator('strong').filter({ hasText: '舊筆記' })).toHaveText('舊筆記');
  await expect(editor.locator('sup')).toHaveText('2');
  await expect.poll(() => placeholderContent(editor)).toBe('none');
  await editor.fill('');
  await expect.poll(() => placeholderContent(editor)).toContain('在檢討答案時');
  await editor.fill('還沒儲存也要保留');
  await expect.poll(() => placeholderContent(editor)).toBe('none');
  await summary.click();
  await summary.click();
  await expect(editor).toHaveText('還沒儲存也要保留');
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(1);
});
