import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/Los_Angeles' });

for (const theme of ['light', 'dark'] as const) {
  test(`home countdown and daily shortcut stay responsive and reset subject choice in ${theme}`, async ({ page, isMobile }, testInfo) => {
    if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
    await page.clock.setFixedTime(new Date('2026-10-26T04:00:00Z'));
    await page.addInitScript(theme => localStorage.setItem('shane-web-theme', theme), theme);
    await page.goto('/');
    const countdown = page.getByRole('region', { name: '115 年建築師考試', exact: true });
    await expect(countdown.getByText('19', { exact: true })).toBeVisible();
    await expect(countdown.getByRole('link', { name: /考選部/ })).toHaveAttribute('href', /moex.gov.tw.*115180/);
    const shortcut = page.getByRole('link', { name: /每日抽題練習.*開始練習/ });
    await expect(shortcut).toHaveAttribute('href', '/practice/quiz');
    expect((await countdown.boundingBox())!.y).toBeLessThan((await shortcut.boundingBox())!.y);
    await expect(page.getByRole('heading', { name: /近一年寫了/ })).toHaveCount(0);
    expect((await countdown.getByText('19', { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(70);
    if (isMobile) await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`home-${theme}.png`), fullPage: true });

    // Updating the date in another timezone still follows the calendar in Taiwan.
    await page.clock.setFixedTime(new Date('2026-11-13T16:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(countdown).toContainText('考試進行中');
    await page.clock.setFixedTime(new Date('2026-11-16T16:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(countdown).toContainText('本次考試已結束');

    await shortcut.click();
    const setup = page.getByRole('region', { name: '每日抽題練習設定', exact: true });
    await expect(setup.getByRole('radio', { checked: true })).toHaveCount(0);
    await expect(setup.getByRole('button', { name: '線上作答', exact: true })).toBeDisabled();
    await expect(setup.getByRole('button', { name: '製作紙本檔案', exact: true })).toBeDisabled();
    await setup.getByRole('radio', { name: /建築環境控制/ }).check();
    await setup.getByRole('button', { name: /進階選項/ }).click();
    await setup.getByRole('button', { name: /^5 題/ }).click();
    await setup.getByRole('button', { name: '線上作答', exact: true }).click();
    const quiz = page.getByRole('region', { name: '每日抽題練習作答', exact: true });
    await quiz.getByRole('radio').first().click();
    await quiz.getByRole('button', { name: '確認答案', exact: true }).click();
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!));
    await page.goto('/');
    await shortcut.click();
    await expect(setup).toBeVisible();
    await expect(setup.getByRole('radio', { checked: true })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!).answers)).toEqual(original.answers);

    await setup.getByRole('radio', { name: /建築法規與實務/ }).check();
    page.once('dialog', dialog => dialog.dismiss());
    await setup.getByRole('button', { name: '線上作答', exact: true }).click();
    await expect(setup).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shaneweb:practice-session')!).id)).toBe(original.id);
    await setup.getByRole('button', { name: '繼續未完成練習', exact: true }).click();
    await expect(page).toHaveURL(/\?q=1$/);
    await expect(quiz.getByRole('status')).toContainText(/答對了|答錯了/);
    await page.reload();
    await expect(quiz.getByRole('status')).toContainText(/答對了|答錯了/);
  });
}
