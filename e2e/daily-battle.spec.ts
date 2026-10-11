import { expect, test, type Page } from '@playwright/test';

async function seed(page: Page, results: boolean[] = [], currentIndex = results.length,
  status: 'practice' | 'review' | 'completed' | 'failed' = 'practice',
  mode: 'adventure' | 'normal' = 'adventure', subject = 'law', hp = 100,
  failureReason?: string, seconds = 60) {
  await page.addInitScript(args => {
    if (localStorage.getItem('shaneweb:daily-practice')) return;
    const { results, currentIndex, status, mode, subject, hp, failureReason, seconds } = args;
    const questionIds = Array.from({ length: mode === 'normal' ? 50 : 74 }, (_, i) => subject + '-114-' + String(i + 1).padStart(2, '0'));
    localStorage.setItem('shaneweb:daily-practice', JSON.stringify({
      rulesVersion: 3, mode, hp, hpUpdatedAtMs: status === 'practice' ? Date.now() : undefined,
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      subjects: [subject], questionIds,
      optionOrders: Object.fromEntries(questionIds.map(id => [id, [0,1,2,3]])),
      answers: Object.fromEntries(results.map((correct,i) => [questionIds[i], { selected: correct ? 0 : 1, correct }])),
      eliminatedOptions: {}, relicUses: {}, protectedWrongIds: [], guardUses: {},
      currentIndex, unreviewedWrongIds: questionIds.filter((_,i) => results[i] === false),
      reviewedWrongIds: [], status, failureReason,
      questionDeadlineMs: mode === 'adventure' && status === 'practice' ? Date.now() + seconds * 1000 : undefined,
    }));
  }, { results, currentIndex, status, mode, subject, hp, failureReason, seconds });
}

async function choose(page: Page, correct: boolean) {
  const data = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('shaneweb:daily-practice')!);
    return { id: session.questionIds[session.currentIndex], subject: session.subjects[0] };
  });
  const response = await page.request.get('/question-data/' + data.subject + '/114.json');
  const question = (await response.json()).find((q: { id: string }) => q.id === data.id);
  const indexes = question.answerKey.kind === 'accepted' ? question.answerKey.options : [0,1,2,3];
  const selected = correct ? indexes[0] : [0,1,2,3].find(i => !indexes.includes(i))!;
  await page.getByRole('radio').nth(selected).click();
  await page.getByRole('button', { name: '確認答案', exact: true }).click();
}

async function pauseAtCast(page: Page, phaseMs: number) {
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionDeadlineMs)).toBeGreaterThan(0);
  const target = await page.evaluate(phase => {
    const session = JSON.parse(localStorage.getItem('shaneweb:daily-practice')!);
    const now = Date.now();
    const elapsed = 60_000 - (session.questionDeadlineMs - now);
    return now + (phase - elapsed % 8000 + 8000) % 8000;
  }, phaseMs);
  await page.clock.pauseAt(new Date(target));
}

test('normal mode defaults to familiar fifty-question practice without a battle', async ({ page }) => {
  await page.goto('/daily');
  await expect(page.getByRole('radio', { name: /正常模式/ })).toBeChecked();
  await page.getByRole('button', { name: '建立今日挑戰' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  await expect(page.getByLabel('建築師勇者')).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionIds.length)).toBe(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('adventure preserves the desktop split and compact single-scroll mobile layout', async ({ page }) => {
  await seed(page);
  await page.goto('/daily');
  const battle = page.locator('[data-stage="1"]');
  const body = page.getByRole('region', { name: '題目與選項' });
  await expect(battle).toBeVisible();
  await expect(page.getByLabel('建照印章獸', { exact: true }).locator('span')).toHaveCSS('background-image', /law-boss-1-v3.webp/);
  await expect(page.getByLabel('建照印章獸', { exact: true }).locator('span')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  if (page.viewportSize()!.width > 1100) {
    const scene = await battle.boundingBox();
    const card = await page.locator('article').filter({ has: body }).boundingBox();
    expect(card!.x).toBeGreaterThanOrEqual(scene!.x + scene!.width);
    await expect(page.getByRole('button', { name: '確認答案' })).toBeInViewport({ ratio: 1 });
  } else {
    await expect(body).toHaveCSS('overflow-y', 'visible');
    expect((await battle.locator('[class*="pixelArena"]').boundingBox())!.height).toBeLessThan(100);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('environmental bosses use distinct subject sprites', async ({ page }) => {
  await seed(page, Array(26).fill(true), 26, 'practice', 'adventure', 'env');
  await page.goto('/daily');
  await expect(page.locator('[data-stage="5"]')).toBeVisible();
  await expect(page.getByLabel('空調機械獸', { exact: true }).locator('span')).toHaveCSS('background-image', /env-boss-5-v3.webp/);
});

test('correct attacks injure the boss and heal HP without changing its facing', async ({ page }) => {
  await seed(page, [true], 0, 'practice', 'adventure', 'law', 75);
  await page.goto('/daily');
  await expect(page.getByLabel('建照印章獸', { exact: true })).toHaveCSS('animation-name', /bossHit/);
  await expect(page.getByLabel('建照印章獸', { exact: true }).locator('span')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(page.getByText('MEASURE HIT!')).toBeVisible();
  await expect(page.getByLabel('建照印章獸剩餘 4 / 5 點血量')).toBeVisible();
});

test('wrong attacks injure the architect without damaging the boss', async ({ page }) => {
  await seed(page, [false], 0, 'practice', 'adventure', 'law', 90);
  await page.goto('/daily');
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('animation-name', /heroHit/);
  await expect(page.getByLabel('建照印章獸剩餘 5 / 5 點血量')).toBeVisible();
  await expect(page.getByText('COUNTER!')).toBeVisible();
  await expect(page.getByText('−10 HP', { exact: true })).toBeVisible();
});

test('five attempts with a mistake keep the first boss alive and offer a fresh question', async ({ page }) => {
  await seed(page, [false,true,true,true,true], 4);
  await page.goto('/daily');
  await expect(page.getByLabel('建照印章獸剩餘 1 / 5 點血量')).toBeVisible();
  await page.getByRole('button', { name: '下一題' }).click();
  await expect(page.locator('[data-stage="1"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '完成錯題檢討再前進' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '確認答案' })).toBeVisible();
});

test('reaching seven mistakes plays defeat with the boss still alive and persists after reload', async ({ page }) => {
  await seed(page, Array(7).fill(false), 7, 'failed', 'adventure', 'law', 0, 'mistakes');
  await page.goto('/daily');
  const battle = page.locator('[data-stage="1"]');
  await expect(battle).toHaveAttribute('data-failed', 'true');
  await expect(page.getByLabel('每日挑戰戰敗')).toHaveText('DEFEAT達到本層錯題上限，遭魔王擊倒');
  await expect(page.getByLabel('建築師剩餘 0 / 100 點血量')).toBeVisible();
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('opacity', '0.35');
  await expect(page.getByLabel('建照印章獸剩餘 5 / 5 點血量')).toBeVisible();
  await page.reload();
  await expect(battle).toHaveAttribute('data-failed', 'true');
});

test('timeout death supports reduced motion and keeps a fallen architect', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, [false], 1, 'failed', 'adventure', 'law', 0, 'time');
  await page.goto('/daily');
  await expect(page.getByLabel('每日挑戰戰敗')).toHaveText('DEFEAT時間耗盡，遭魔王擊倒');
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('animation-name', 'none');
  await expect(page.getByLabel('建築師勇者')).toHaveCSS('opacity', '0.35');
});

test('periodic attacks drain cumulative HP continuously without resetting per question', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seed(page, [], 0, 'practice', 'adventure', 'law', 60);
  await page.goto('/daily');
  const hp = page.getByRole('progressbar', { name: '累積血量' });
  await expect(hp).toBeVisible();
  const before = Number(await hp.getAttribute('aria-valuenow'));
  await pauseAtCast(page, 7200);
  expect(Number(await hp.getAttribute('aria-valuenow'))).toBeLessThan(before);
  await expect(page.locator('[data-stage="1"]')).toHaveAttribute('data-striking', 'true');
  await expect(page.locator('[class*="enemyBolt"]')).toBeAttached();
  await choose(page, true);
  const healed = Number(await hp.getAttribute('aria-valuenow'));
  expect(healed).toBeLessThan(100);
  await page.getByRole('button', { name: '下一題' }).click();
  expect(Number(await hp.getAttribute('aria-valuenow'))).toBe(healed);
});

test('perfect guard extends time and remains consumed after reload without refilling HP', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seed(page, [], 0, 'practice', 'adventure', 'law', 60, undefined, 54);
  await page.goto('/daily');
  const guard = page.getByRole('button', { name: '架設防禦：每關一次，蓄力亮紅時完美格擋' });
  await expect(guard).toBeEnabled();
  await pauseAtCast(page, 6000);
  const deadline = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionDeadlineMs);
  await guard.click();
  await expect(page.getByText('完美格擋！延長 5 秒，防護 3 秒')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionDeadlineMs)).toBe(deadline + 5000);
  await page.clock.resume();
  await page.reload();
  await expect(guard).toBeDisabled();
  expect(Number(await page.getByRole('progressbar', { name: '累積血量' }).getAttribute('aria-valuenow'))).toBeLessThanOrEqual(60);
});

test('fifty correct defeats the subject final boss and shows victory', async ({ page }) => {
  await seed(page, Array(50).fill(true), 50, 'completed', 'adventure', 'law', 70);
  await page.goto('/daily');
  await expect(page.getByLabel('六層挑戰勝利')).toBeVisible();
  await expect(page.getByLabel('技規法典龍剩餘 0 / 15 點血量')).toBeVisible();
  await expect(page.getByLabel('技規法典龍', { exact: true })).toHaveCSS('opacity', '0');
});

test('long illustrated questions use natural mobile scrolling while desktop keeps its button', async ({ page }) => {
  await page.route('**/question-data/law/114.json', async route => {
    const response = await route.fetch();
    const questions = await response.json();
    const q = questions.find((item: { id: string }) => item.id === 'law-114-01');
    q.content = [
      { kind: 'text', text: Array(35).fill('長題內容完整保留，請自然向下閱讀。').join('\n') },
      { kind: 'image', src: '/daily-game/stage-1-v2.webp', alt: '長題附圖', width: 512, height: 512 },
    ];
    await route.fulfill({ json: questions });
  });
  await seed(page);
  await page.goto('/daily');
  const body = page.getByRole('region', { name: '題目與選項' });
  await expect(body).toBeVisible();
  const sizes = await body.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
  if (page.viewportSize()!.width <= 1100) {
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.height + 1);
    await page.getByRole('radio').last().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await expect(page.getByRole('button', { name: /放大題目圖片/ })).toBeAttached();
  } else {
    expect(sizes.scroll).toBeGreaterThan(sizes.height + 100);
    await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
  }
  await page.getByRole('radio').last().click();
  await expect(page.getByRole('button', { name: '確認答案' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
