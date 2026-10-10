import { expect, test } from '@playwright/test';

test('daily battle stays compact and visible while answering', async ({ page }) => {
  await page.goto('/daily');
  await page.getByRole('button', { name: '建立今日挑戰' }).click();
  const battle = page.locator('[data-stage]').first();
  await expect(battle).toBeVisible();
  const initial = await battle.boundingBox();
  expect(initial!.height).toBeLessThan(250);
  await page.getByRole('button', { name: '確認答案' }).scrollIntoViewIfNeeded();
  const scrolled = await battle.boundingBox();
  expect(scrolled!.y).toBeGreaterThanOrEqual(60);
  expect(scrolled!.y + scrolled!.height).toBeLessThan(page.viewportSize()!.height - 100);
  await expect(page.getByRole('button', { name: '確認答案' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('completed daily run defeats the dragon and displays victory', async ({ page }) => {
  await page.addInitScript(() => {
    const questionIds = Array.from({ length: 50 }, (_, i) => `law-114-${String(i + 1).padStart(2, '0')}`);
    localStorage.setItem('shaneweb:daily-practice', JSON.stringify({
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      subjects: ['law'], questionIds,
      optionOrders: Object.fromEntries(questionIds.map(id => [id, [0, 1, 2, 3]])),
      answers: Object.fromEntries(questionIds.map((id, i) => [id, { selected: i === 49 ? 1 : 0, correct: i !== 49 }])),
      eliminatedOptions: {}, relicUses: {}, protectedWrongIds: [],
      currentIndex: 50, unreviewedWrongIds: [], reviewedWrongIds: [], status: 'completed',
    }));
  });
  await page.goto('/daily');
  await expect(page.getByLabel('六層挑戰勝利')).toBeVisible();
  await expect(page.getByLabel('天際龍王剩餘 0 / 15 點血量')).toBeVisible();
  const boss = page.getByLabel('天際龍王', { exact: true });
  await expect(boss).toHaveCSS('opacity', '0');
});
