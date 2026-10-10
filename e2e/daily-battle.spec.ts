import { expect, test, type Page } from '@playwright/test';

async function seedRun(
  page: Page,
  currentIndex: number,
  status: 'practice' | 'failed',
  results: boolean[],
  timedOut = false,
  remainingSeconds = 60,
) {
  await page.addInitScript(({ currentIndex, status, results, timedOut, remainingSeconds }) => {
    if (localStorage.getItem('shaneweb:daily-practice')) return;
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
      questionDeadlineMs: Date.now() + remainingSeconds * 1000,
    }));
  }, { currentIndex, status, results, timedOut, remainingSeconds });
}

async function pauseAtCast(page: Page, phaseMs: number) {
  const target = await page.evaluate(phase => {
    const session = JSON.parse(localStorage.getItem('shaneweb:daily-practice')!);
    const now = Date.now();
    const elapsed = 60_000 - (session.questionDeadlineMs - now);
    return now + (phase - elapsed % 8000 + 8000) % 8000;
  }, phaseMs);
  await page.clock.pauseAt(new Date(target));
}

test('larger battle and answer button share the viewport without page scrolling', async ({ page }) => {
  await page.goto('/daily');
  await page.getByRole('button', { name: '建立今日挑戰' }).click();
  const battle = page.locator('[data-stage]').first();
  await expect(battle).toBeVisible();
  const initial = await battle.boundingBox();
  expect(initial!.height).toBeGreaterThan(250);
  expect(initial!.height).toBeLessThan(530);
  const sidebar = await page.getByRole('complementary', { name: '挑戰資訊' }).boundingBox();
  const question = await page.locator('article').filter({
    has: page.getByRole('button', { name: '確認答案' }),
  }).boundingBox();
  if (page.viewportSize()!.width > 1100) {
    expect(question!.x).toBeGreaterThanOrEqual(initial!.x + initial!.width);
    expect(sidebar!.y).toBeGreaterThan(initial!.y + initial!.height);
    expect(Math.abs(initial!.y - question!.y)).toBeLessThan(2);
  } else {
    expect(sidebar!.y).toBeGreaterThanOrEqual(question!.y + question!.height);
  }
  await expect(page.getByLabel('砌縫咕嚕', { exact: true }).locator('span')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await expect(page.getByRole('button', { name: '確認答案' })).toBeInViewport({ ratio: 1 });
  const scrolled = await battle.boundingBox();
  expect(scrolled!.y).toBeGreaterThanOrEqual(60);
  expect(scrolled!.y + scrolled!.height).toBeLessThan(page.viewportSize()!.height - 100);
  await expect(page.getByRole('button', { name: '確認答案' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  // Native scroll anchoring may settle a few pixels as a random question's image loads.
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(10);
  await expect(battle.locator('[class*="pixelArena"]')).toHaveCSS('background-image', /stage-1-v2.webp/);
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

test('boss telegraphs ongoing attacks while the real countdown drains the HP bar', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seedRun(page, 0, 'practice', []);
  await page.goto('/daily');
  const hp = page.getByRole('progressbar', { name: '本題倒數血量' });
  await expect(hp).toBeVisible();
  const before = Number(await hp.getAttribute('aria-valuenow'));
  await pauseAtCast(page, 7200);
  expect(Number(await hp.getAttribute('aria-valuenow'))).toBeLessThan(before);
  await expect(page.getByLabel(/第 1 層 磚造巷口/)).toHaveAttribute('data-striking', 'true');
  await expect(page.locator('[class*="enemyBolt"]')).toBeAttached();
  await expect(page.getByLabel('建築師剩餘 3 / 3 點血量')).toBeVisible();
});

test('perfect guard has an actual timed benefit and cannot be reused after reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seedRun(page, 0, 'practice', [], false, 54);
  await page.goto('/daily');
  const guard = page.getByRole('button', { name: '架設防禦：每關一次，蓄力亮紅時完美格擋' });
  await expect(guard).toBeEnabled();
  await pauseAtCast(page, 6000);
  const deadline = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionDeadlineMs);
  await guard.click();
  await expect(page.getByText('完美格擋！延長 5 秒，防護 3 秒')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionDeadlineMs)).toBe(deadline + 5000);
  await expect(guard).toBeDisabled();
  // Hydration schedules work too; don't freeze Next/React while reloading.
  await page.clock.resume();
  await page.reload();
  await expect(guard).toBeDisabled();
  await page.clock.fastForward(3000);
  await expect(page.getByLabel(/第 1 層 磚造巷口/)).toHaveAttribute('data-casting', 'true');
});

test('long illustrated questions scroll inside the card while the attack button stays visible', async ({ page }) => {
  await page.route('**/question-data/law/114.json', async route => {
    const response = await route.fetch();
    const questions = await response.json();
    const target = questions.find((question: { id: string }) => question.id === 'law-114-01');
    target.content = [
      { kind: 'text', text: Array(50).fill('長題內容完整保留，可在題目區內向下閱讀。').join('\n') },
      { kind: 'image', src: '/daily-game/stage-1-v2.webp', alt: '長題測試附圖', width: 512, height: 512 },
    ];
    await route.fulfill({ json: questions });
  });
  await seedRun(page, 0, 'practice', []);
  await page.goto('/daily');
  const body = page.getByRole('region', { name: '題目與選項' });
  await expect(body).toBeVisible();
  const sizes = await body.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
  expect(sizes.scroll).toBeGreaterThan(sizes.height + 100);
  await expect(page.getByRole('button', { name: '確認答案' })).toBeInViewport({ ratio: 1 });
  await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(page.getByRole('radio').last()).toBeInViewport();
  await expect(page.getByRole('button', { name: '確認答案' })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
});
