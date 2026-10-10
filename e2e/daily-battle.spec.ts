import { expect, test, type Page } from '@playwright/test';

async function seedRun(
  page: Page,
  currentIndex: number,
  status: 'practice' | 'failed',
  results: boolean[],
  timedOut = false,
) {
  await page.addInitScript(({ currentIndex, status, results, timedOut }) => {
    const questionIds = Array.from({ length: 50 }, (_, i) => `law-114-${String(i + 1).padStart(2, '0')}`);
    localStorage.setItem('shaneweb:daily-practice', JSON.stringify({
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      subjects: ['law'], questionIds,
      optionOrders: Object.fromEntries(questionIds.map(id => [id, [0, 1, 2, 3]])),
      answers: Object.fromEntries(results.map((correct, i) => [questionIds[i], {
        selected: correct ? 0 : 1, correct,
        ...(timedOut && i === results.length - 1 ? { timedOut: true } : {}),
      }])),
      eliminatedOptions: {}, relicUses: {}, protectedWrongIds: [],
      currentIndex, unreviewedWrongIds: [], reviewedWrongIds: [], status,
    }));
  }, { currentIndex, status, results, timedOut });
}

test('daily battle stays compact and visible while answering', async ({ page }) => {
  await page.goto('/daily');
  await page.getByRole('button', { name: '建立今日挑戰' }).click();
  const battle = page.locator('[data-stage]').first();
  await expect(battle).toBeVisible();
  const initial = await battle.boundingBox();
  expect(initial!.height).toBeLessThan(250);
  const sidebar = await page.getByRole('complementary', { name: '挑戰資訊' }).boundingBox();
  const question = await page.locator('article').filter({
    has: page.getByRole('button', { name: '確認答案' }),
  }).boundingBox();
  if (page.viewportSize()!.width > 1100) {
    expect(sidebar!.x).toBeGreaterThanOrEqual(question!.x + question!.width);
    expect(Math.abs(sidebar!.y - question!.y)).toBeLessThan(2);
  } else {
    expect(sidebar!.y).toBeGreaterThanOrEqual(question!.y + question!.height);
  }
  await expect(page.getByLabel('砌縫咕嚕', { exact: true }).locator('span')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
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
  await expect(boss.locator('span')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
});

test('fortress turtle faces the architect independently of its animation', async ({ page }) => {
  await seedRun(page, 26, 'practice', Array(26).fill(true));
  await page.goto('/daily');
  await expect(page.locator('[data-stage="5"]')).toBeVisible();
  const boss = page.getByLabel('鋼筋堡壘獸', { exact: true });
  await expect(boss.locator('span')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
});

test('correct answer triggers boss recoil without changing its facing', async ({ page }) => {
  await seedRun(page, 0, 'practice', [true]);
  await page.goto('/daily');
  const boss = page.getByLabel('砌縫咕嚕', { exact: true });
  await expect(boss).toHaveCSS('animation-name', /bossHit/);
  await expect(boss.locator('span')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await expect(page.getByText('MEASURE HIT!')).toBeVisible();
});

test('wrong answer triggers architect injury with reduced life', async ({ page }) => {
  await seedRun(page, 1, 'practice', [true, false]);
  await page.goto('/daily');
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('animation-name', /heroHit/);
  await expect(page.getByLabel('建築師剩餘 2 / 3 點血量')).toBeVisible();
  await expect(page.getByText('COUNTER!')).toBeVisible();
});

test('defeat at stage boundary shows a fallen architect and remains failed after reload', async ({ page }) => {
  await seedRun(page, 5, 'failed', [true, false, true, false, false]);
  await page.goto('/daily');
  const battle = page.locator('[data-stage="1"]');
  await expect(battle).toHaveAttribute('data-failed', 'true');
  await expect(page.getByLabel('每日挑戰戰敗')).toBeVisible();
  await expect(page.getByLabel('建築師剩餘 0 / 3 點血量')).toBeVisible();
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('opacity', '0.35');
  await page.reload();
  await expect(battle).toHaveAttribute('data-failed', 'true');
  await expect(page.getByLabel('每日挑戰戰敗')).toBeVisible();
});

test('timeout defeat supports reduced motion and still displays the fallen state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedRun(page, 5, 'failed', [true, true, true, true, false], true);
  await page.goto('/daily');
  await expect(page.getByLabel('每日挑戰戰敗')).toHaveText('DEFEAT時間耗盡，遭魔王擊倒');
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('animation-name', 'none');
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('opacity', '0.35');
  await expect(page.getByLabel('建築師剩餘 0 / 3 點血量')).toBeVisible();
});
