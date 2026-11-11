import { expect, test } from '@playwright/test';

test('community and settings prevent accidental selection while color fields stay editable', async ({ page }) => {
  await page.goto('/threads');
  await expect(page.getByRole('heading', { name: '一起備考，也一起交流。' })).toHaveCSS('user-select', 'none');
  await expect(page.getByRole('link', { name: /^前往 Threads/ })).toHaveAttribute('href', 'https://www.threads.com/@archi.exam_sup');

  const navigation = page.getByRole('navigation', { name: '主要功能', exact: true });
  if (!(await navigation.isVisible())) await page.getByRole('button', { name: '開啟選單' }).click();
  await expect(navigation.getByRole('link', { name: '每日練習', exact: true })).toHaveCSS('user-select', 'none');
  await navigation.getByRole('link', { name: '設定', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '設定' });
  await expect(dialog.getByRole('heading', { name: '設定' })).toHaveCSS('user-select', 'none');
  await dialog.getByText('介面配色設定', { exact: true }).click();
  await dialog.getByText('進階設定', { exact: true }).click();
  const color = dialog.getByLabel('頁面背景十六進位色碼');
  await expect(color).toHaveCSS('user-select', 'text');
  await color.fill('#123456');
  await color.evaluate((input: HTMLInputElement) => input.setSelectionRange(0, input.value.length));
  expect(await color.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBe(7);
});

test('navigation cards are protected without blocking their links', async ({ page }) => {
  await page.goto('/');
  const shortcut = page.getByRole('link', { name: /每日抽題練習/ });
  await expect(shortcut).toHaveCSS('user-select', 'none');
  await expect(shortcut).toHaveAttribute('href', '/practice/quiz');
  await expect(page.getByRole('link', { name: /建築環境控制/ })).toHaveCSS('user-select', 'none');
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: '每日抽題練習' })).toHaveCSS('user-select', 'none');
  await page.goto('/resources');
  await expect(page.getByRole('heading', { name: '考題分析' })).toHaveCSS('user-select', 'none');
});

test('exam and practice selectors do not select text and still work', async ({ page }) => {
  await page.goto('/exams/law/114/1');
  const expand = page.getByRole('button', { name: '展開科目與年度' });
  if (await expand.isVisible()) await expand.click();
  const selector = page.getByRole('region', { name: '題目選擇' });
  await expect(selector.getByText('營建法規與實務')).toHaveCSS('user-select', 'none');
  await expect(page.getByRole('radiogroup', { name: '題目選項' })).not.toHaveCSS('user-select', 'none');

  await page.goto('/practice/quiz');
  const daily = page.getByRole('region', { name: '每日抽題練習設定' });
  await expect(daily.getByText('選擇科目', { exact: true })).toHaveCSS('user-select', 'none');
  await daily.getByRole('radio', { name: /營建法規與實務/ }).check();
  await expect(daily.getByRole('radio', { name: /營建法規與實務/ })).toBeChecked();

  await page.goto('/practice/mock-exam');
  await expect(page.getByRole('region', { name: '歷屆試題模擬考設定' }).getByText('選擇科目', { exact: true })).toHaveCSS('user-select', 'none');
});

test('cloze setup cannot be selected but the article and answers remain usable', async ({ page }) => {
  await page.goto('/practice/law-cloze');
  await expect(page.getByRole('heading', { name: '法規克漏字', level: 2 })).toHaveCSS('user-select', 'none');
  await page.getByRole('combobox', { name: '法規', exact: true }).selectOption('building-act');
  await page.getByRole('button', { name: '開始測驗', exact: true }).click();
  await expect(page.getByLabel('填空完整條文')).not.toHaveCSS('user-select', 'none');
  const answer = page.getByRole('textbox').first();
  await answer.fill('123');
  await expect(answer).toHaveValue('123');
});
