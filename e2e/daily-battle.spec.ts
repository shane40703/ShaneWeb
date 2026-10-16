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
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionDeadlineMs)).toBeGreaterThan(0);
  const target = await page.evaluate(phase => {
    const session = JSON.parse(localStorage.getItem('shaneweb:daily-practice')!);
    const now = Date.now();
    const elapsed = 60_000 - (session.questionDeadlineMs - now);
    return now + (phase - elapsed % 8000 + 8000) % 8000;
  }, phaseMs);
  await page.clock.pauseAt(new Date(target));
}

async function openReadingSettings(page: Page) {
  const menu = page.getByRole('button', { name: '開啟選單' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: '設定', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '設定', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/daily$/);
  await dialog.locator('summary').getByText('閱讀設定', { exact: true }).click();
  return dialog;
}

async function closeReadingSettings(page: Page) {
  const dialog = page.getByRole('dialog', { name: '設定', exact: true });
  await dialog.locator('header').getByRole('button', { name: '關閉設定' }).click();
  await expect(dialog).toHaveCount(0);
}

test('normal mode defaults to familiar fifty-question practice without a battle', async ({ page }) => {
  await page.goto('/daily');
  await expect(page.getByRole('radio', { name: /正常模式/ })).toBeChecked();
  await expect(page.getByText('建築師的六層試煉')).toHaveCount(0);
  await expect(page.getByLabel('每日練習規則')).toHaveCount(0);
  await page.getByRole('radio', { name: /以闖關模式進行/ }).click();
  await expect(page.getByLabel('每日練習規則')).toHaveCount(0);
  await page.getByRole('radio', { name: /正常模式/ }).click();
  await page.getByRole('button', { name: '線上作答' }).click();
  await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible();
  await expect(page.getByLabel('建築師勇者')).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).questionIds.length)).toBe(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

for (const mode of ['normal', 'adventure'] as const) {
  test(`${mode} global reading settings apply to questions and options, preserve drafts and survive reload`, async ({ page }) => {
    await seed(page, [], 0, 'practice', mode);
    await page.goto('/daily');
    const body = page.getByRole('region', { name: '題目與選項' });
    await expect(body).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('字體大小', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('slider')).toHaveCount(0);
    const prompt = body.locator('[class*="questionPromptText"]').first();
    const optionText = body.getByRole('radiogroup').locator('label').first().locator('span').last();
    await expect(prompt).toHaveCSS('font-size', '18px');
    await expect(optionText).toHaveCSS('font-size', '18px');
    await page.getByRole('radio').first().click();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!));
    const settings = await openReadingSettings(page);
    const questionSize = settings.getByRole('slider', { name: '題目字體' });
    const optionSize = settings.getByRole('slider', { name: '選項字體' });
    await questionSize.focus();
    await questionSize.press('End');
    await optionSize.focus();
    await optionSize.press('Home');
    await expect(prompt).toHaveCSS('font-size', '24px');
    await expect(optionText).toHaveCSS('font-size', '14px');
    await optionSize.press('End');
    await expect(optionText).toHaveCSS('font-size', '24px');
    await closeReadingSettings(page);
    await expect(page.getByRole('radio').first()).toBeChecked();
    await expect(page.getByRole('button', { name: '確認答案' })).toBeEnabled();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!));
    expect(after.questionIds).toEqual(before.questionIds);
    expect(after.currentIndex).toBe(before.currentIndex);
    expect(after.answers).toEqual(before.answers);
    expect(after.questionDeadlineMs).toBe(before.questionDeadlineMs);
    await expect(body).toHaveCSS('overflow-y', 'visible');
    const size = await body.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
    expect(size.scroll).toBeLessThanOrEqual(size.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).readingPreferences)).toEqual({
      questionFontSize: 24, optionFontSize: 24,
    });
    await page.reload();
    await expect(prompt).toHaveCSS('font-size', '24px');
    await expect(optionText).toHaveCSS('font-size', '24px');
    await expect(page.getByText('字體大小', { exact: true })).toHaveCount(0);
    await openReadingSettings(page);
    await expect(questionSize).toHaveValue('24');
    await expect(optionSize).toHaveValue('24');
    await closeReadingSettings(page);
  });
}

for (const status of ['review', 'completed'] as const) {
  test(`global reading settings also apply to ${status} question and answer panels`, async ({ page }) => {
    const review = status === 'review';
    await seed(page, review ? [false,true,true,true,true,true] : Array(50).fill(false), review ? 6 : 50,
      status, review ? 'adventure' : 'normal');
    await page.goto('/daily');
    await expect(page.getByRole('region', { name: '題目選項' }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('字體大小', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('slider')).toHaveCount(0);
    const settings = await openReadingSettings(page);
    await settings.getByRole('slider', { name: '題目字體' }).focus();
    await settings.getByRole('slider', { name: '題目字體' }).press('End');
    await settings.getByRole('slider', { name: '選項字體' }).focus();
    await settings.getByRole('slider', { name: '選項字體' }).press('Home');
    await closeReadingSettings(page);
    await expect(page.locator('[class*="questionPromptText"]').first()).toHaveCSS('font-size', '24px');
    await expect(page.getByRole('region', { name: '題目選項' }).first().locator('li > span').first()).toHaveCSS('font-size', '14px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}

test('adventure preserves the desktop split and uses a single page scroll at every size', async ({ page }) => {
  await seed(page);
  await page.goto('/daily');
  const battle = page.locator('[data-stage="1"]');
  const body = page.getByRole('region', { name: '題目與選項' });
  await expect(battle).toBeVisible();
  await expect(body).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('建照印章獸', { exact: true }).locator('span')).toHaveCSS('background-image', /law-boss-1-v5\.webp/);
  await expect(page.getByLabel('建照印章獸', { exact: true }).locator('span')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  if (page.viewportSize()!.width > 1100) {
    const scene = await battle.boundingBox();
    const card = await page.locator('article').filter({ has: body }).boundingBox();
    expect(card!.x).toBeGreaterThanOrEqual(scene!.x + scene!.width);
  } else {
    expect((await battle.locator('[class*="pixelArena"]').boundingBox())!.height).toBeLessThan(100);
  }
  await expect(body).toHaveCSS('overflow-y', 'visible');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('environmental bosses use distinct subject sprites', async ({ page }) => {
  await seed(page, Array(26).fill(true), 26, 'practice', 'adventure', 'env');
  await page.goto('/daily');
  await expect(page.locator('[data-stage="5"]')).toBeVisible();
  await expect(page.getByLabel('空調機械獸', { exact: true }).locator('span')).toHaveCSS('background-image', /env-boss-5-v5\.webp/);
});

for (const mode of ['normal', 'adventure'] as const) {
  test(`${mode} correct answers allow notes that persist after reload without changing the answer`, async ({ page }) => {
    await seed(page, [], 0, 'practice', mode);
    await page.goto('/daily');
    await expect(page.getByRole('region', { name: '題目與選項' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('textbox', { name: '第 1 題筆記內容' })).toHaveCount(0);
    await choose(page, true);
    const note = page.getByRole('textbox', { name: '第 1 題筆記內容' });
    await note.fill('**答對也要記下觀念**');
    await page.getByRole('button', { name: '儲存筆記', exact: true }).click();
    await expect(page.getByRole('button', { name: '分享至詳解與討論' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:state')!).notes['law-114-01']))
      .toBe('**答對也要記下觀念**');
    await page.reload();
    await expect(note).toHaveValue('**答對也要記下觀念**', { timeout: 20_000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).answers['law-114-01'].correct)).toBe(true);
    await expect(page.getByRole('timer')).toHaveCount(0);
    await expect(page.getByRole('region', { name: '題目與選項' })).toHaveCSS('overflow-y', 'visible');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.getByRole('button', { name: '下一題', exact: true }).click();
    await choose(page, true);
    await expect(page.getByRole('textbox', { name: '第 2 題筆記內容' })).toHaveValue('');
  });
}

test('stage transitions pause health and time, animate, then automatically start the next stage', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seed(page, Array(5).fill(true), 5, 'review', 'adventure', 'law', 63);
  await page.goto('/daily');
  await expect(page.getByRole('heading', { name: '無傷通關！' })).toBeVisible({ timeout: 20_000 });
  const review = page.locator('[class*="questionArea"]');
  const beforeReview = await review.boundingBox();
  const beforeArena = await page.locator('[class*="pixelArena"]').boundingBox();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 500));
  await page.getByRole('button', { name: '繼續闖關' }).click();
  const transition = page.getByRole('region', { name: '換層過場' });
  await expect(transition).toBeVisible();
  await expect(page.locator('[class*="battleColumn"]').getByRole('region', { name: '換層過場' })).toBeVisible();
  await expect(review.getByRole('region', { name: '換層過場' })).toHaveCount(0);
  await expect(review.getByRole('heading', { name: '無傷通關！' })).toBeVisible();
  await expect(page.getByRole('button', { name: '正在前往下一層…' })).toBeDisabled();
  expect((await transition.locator('[class*="pixelArena"]').boundingBox())!.height).toBe(beforeArena!.height);
  const afterReview = await review.boundingBox();
  expect(afterReview!.x).toBe(beforeReview!.x);
  expect(afterReview!.width).toBe(beforeReview!.width);
  if (page.viewportSize()!.width > 1100) {
    const scene = await transition.boundingBox();
    expect(scene!.x + scene!.width).toBeLessThanOrEqual(afterReview!.x);
  }
  await expect(transition.getByRole('heading')).toHaveText('前往第 2 層・迴廊');
  await expect(transition.locator('[class*="transitionArchitect"]')).toHaveCSS('animation-name', /stageWalk/);
  await page.clock.runFor(900);
  const paused = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!));
  expect(paused).toMatchObject({ status: 'review', hp: 63, currentIndex: 5 });
  expect(paused.questionDeadlineMs).toBeUndefined();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '確認答案' })).toHaveCount(0);
  await transition.screenshot({ path: testInfo.outputPath('stage-transition.png'), animations: 'disabled' });
  await page.clock.runFor(1000);
  await expect(transition).toHaveCount(0);
  await expect(page.locator('[data-stage="2"]')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  expect(await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('shaneweb:daily-practice')!);
    return s.questionDeadlineMs - Date.now();
  })).toBeGreaterThan(59_000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('reloading a transition safely returns to paused review and allows skipping it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seed(page, Array(5).fill(true), 5, 'review', 'adventure', 'env', 48);
  await page.goto('/daily');
  await expect(page.getByRole('heading', { name: '無傷通關！' })).toBeVisible({ timeout: 20_000 });
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 500));
  await page.getByRole('button', { name: '繼續闖關' }).click();
  await expect(page.getByRole('region', { name: '換層過場' })).toBeVisible();
  // A frozen requestAnimationFrame prevents Next's hydration after navigation.
  // Resume before reloading; the persisted review itself has no active timer.
  await page.clock.resume();
  await page.reload();
  await expect(page.getByRole('heading', { name: '無傷通關！' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('timer')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:daily-practice')!).hp)).toBe(48);
  await page.getByRole('button', { name: '繼續闖關' }).click();
  await page.getByRole('button', { name: '略過過場' }).click();
  await expect(page.locator('[data-stage="2"]')).toBeVisible();
  await expect(page.getByRole('region', { name: '換層過場' })).toHaveCount(0);
});

test('stage transitions respect reduced motion and finish without a walking animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-11T04:00:00+08:00') });
  await seed(page, Array(5).fill(true), 5, 'review');
  await page.goto('/daily');
  await expect(page.getByRole('heading', { name: '無傷通關！' })).toBeVisible({ timeout: 20_000 });
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 500));
  await page.getByRole('button', { name: '繼續闖關' }).click();
  const transition = page.getByRole('region', { name: '換層過場' });
  await expect(transition.locator('[class*="transitionArchitect"]')).toHaveCSS('animation-name', 'none');
  await page.clock.runFor(350);
  await expect(transition).toHaveCount(0);
  await expect(page.locator('[data-stage="2"]')).toBeVisible();
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

for (const mode of ['normal', 'adventure'] as const) {
  test(`${mode} long questions expand fully and use only the page scroll on desktop and mobile`, async ({ page }) => {
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
    await seed(page, [], 0, 'practice', mode);
    await page.goto('/daily');
    const body = page.getByRole('region', { name: '題目與選項' });
    await expect(body).toBeVisible({ timeout: 20_000 });
    const sizes = await body.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
    await expect(body).toHaveCSS('overflow-y', 'visible');
    const card = page.locator('article').filter({ has: body });
    await expect(card).toHaveCSS('max-height', 'none');
    await expect(card.locator('..')).toHaveCSS('max-height', 'none');
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.height + 1);
    await page.getByRole('radio').last().scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    expect(await body.evaluate(el => el.scrollTop)).toBe(0);
    await expect(page.getByRole('button', { name: /放大題目圖片/ })).toBeAttached();
    await page.getByRole('radio').last().click();
    await expect(page.getByRole('button', { name: '確認答案' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
}

test('the construction wall table is fully contained in an expanding question card', async ({ page }) => {
  await seed(page, [], 0, 'practice', 'adventure', 'construction');
  await page.addInitScript(() => {
    const session = JSON.parse(localStorage.getItem('shaneweb:daily-practice')!);
    session.questionIds[0] = 'construction-104-17';
    session.optionOrders['construction-104-17'] = [0,1,2,3];
    localStorage.setItem('shaneweb:daily-practice', JSON.stringify(session));
  });
  await page.goto('/daily');
  const body = page.getByRole('region', { name: '題目與選項' });
  await expect(body).toBeVisible({ timeout: 20_000 });
  const image = body.locator('figure img').first();
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS('max-height', 'none');
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const content = await body.boundingBox();
  const picture = await image.boundingBox();
  const options = await body.getByRole('radiogroup').boundingBox();
  expect(picture!.y).toBeGreaterThanOrEqual(content!.y);
  expect(options!.y).toBeGreaterThanOrEqual(picture!.y + picture!.height);
  expect(content!.y + content!.height).toBeGreaterThanOrEqual(options!.y + options!.height);
  await expect(body).toHaveCSS('overflow-y', 'visible');
  const sizes = await body.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.height + 1);
  await page.getByRole('radio').first().click();
  const confirm = page.getByRole('button', { name: '確認答案', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport({ ratio: 1 });
  expect(await body.evaluate(el => el.scrollTop)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
