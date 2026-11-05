import { expect, test } from '@playwright/test';

test('drafting cursor appears on paper, snaps to the grid, and leaves controls alone', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the drafting cursor is only for a mouse');
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto('/');
  const crosshair = page.getByTestId('grid-crosshair');
  await expect(crosshair).toBeHidden();

  await page.mouse.move(273, 81);
  await expect(crosshair).toBeVisible();
  await expect(crosshair).toHaveAttribute('data-snapped', '');
  await expect(crosshair).toHaveCSS('left', '272px');
  await expect(crosshair).toHaveCSS('top', '80px');
  expect(await page.evaluate(() => getComputedStyle(document.elementFromPoint(273, 81)!).cursor)).toBe('none');
  await page.mouse.move(279, 87);
  await expect(crosshair).not.toHaveAttribute('data-snapped');
  await expect(crosshair).toHaveCSS('left', '279px');

  await page.getByRole('button', { name: /切換為深色模式/ }).hover();
  await expect(crosshair).toBeHidden();
  await page.getByRole('button', { name: /切換為深色模式/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.mouse.move(273, 81);
  await expect(crosshair).toBeVisible();
  await page.mouse.wheel(0, 300);
  await expect(crosshair).toBeHidden();
});

test('touch does not replace the normal pointer', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch behavior is checked on the mobile project');
  await page.goto('/');
  await page.locator('main').dispatchEvent('pointermove', { pointerType: 'touch', clientX: 4, clientY: 70 });
  await expect(page.getByTestId('grid-crosshair')).toBeHidden();
  await expect(page.locator('[data-grid-cursor]')).toHaveCount(0);
});
