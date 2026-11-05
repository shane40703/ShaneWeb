import { expect, test } from '@playwright/test';

test('paper grid and appearance preview follow the active theme', async ({ page }) => {
  await page.goto('/appearance');
  const body = page.locator('body');
  const canvas = page.locator('[class*="previewCanvas"]');
  const grid = (element: Element) => ({
    size: getComputedStyle(element).backgroundSize,
    image: getComputedStyle(element).backgroundImage,
  });

  await expect(canvas).toBeVisible();
  const light = await body.evaluate(grid);
  const lightPreview = await canvas.evaluate(grid);
  expect(light.size).toBe('64px 64px, 64px 64px, 16px 16px, 16px 16px');
  expect(lightPreview.size).toBe(light.size);
  expect(light.image.match(/radial-gradient/g)).toHaveLength(2);
  expect(lightPreview.image.match(/radial-gradient/g)).toHaveLength(2);
  expect(light.image).toContain('rgba(128, 128, 128, 0.35)');
  expect(lightPreview.image).toContain('rgba(128, 128, 128, 0.35)');

  await page.getByRole('button', { name: '切換為深色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => body.evaluate(grid)).not.toEqual(light);
  // The editor intentionally previews the mode selected in its own controls.
  await page.getByRole('radio', { name: '深色模式', exact: true }).locator('..').click();
  await expect.poll(() => canvas.evaluate(grid)).not.toEqual(lightPreview);
  expect((await body.evaluate(grid)).image).toContain('rgba(128, 128, 128, 0.35)');
  expect((await canvas.evaluate(grid)).image).toContain('rgba(128, 128, 128, 0.35)');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
