import { expect, test, type Page, type TestInfo } from '@playwright/test';

const iPhoneSafari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const iPhoneFacebook =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0]';
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const androidWebView =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 Barcelona 400.0.0.0';

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== 'mobile', 'the drawer is the phone layout');
}

async function openNavigation(page: Page) {
  const nav = page.getByRole('navigation', { name: '主要功能', exact: true });
  // The phone drawer button can render before hydration, so retry until it opens.
  await expect(async () => {
    if (!(await nav.isVisible()))
      await page.getByRole('button', { name: '開啟選單' }).click({ timeout: 1000 });
    await expect(nav).toBeVisible({ timeout: 1000 });
  }).toPass();
  return nav;
}

const addButton = (page: Page) =>
  page.getByRole('button', { name: '加入主畫面', exact: true });
const guide = (page: Page) =>
  page.getByRole('dialog', { name: '加入主畫面', exact: true });
const titleOf = (page: Page) =>
  guide(page).getByRole('heading', { name: '加入主畫面', exact: true });
// The open guide hides the drawer from getByRole while it is still sliding out.
const drawer = (page: Page) =>
  page.getByRole('dialog', { name: '主要功能', exact: true, includeHidden: true });

async function openGuide(page: Page) {
  await openNavigation(page);
  await addButton(page).tap();
  await expect(guide(page)).toBeVisible();
  await expect(drawer(page)).toHaveCount(0);
}

async function scrollToClose(page: Page) {
  const close = page.getByRole('button', { name: '知道了', exact: true });
  await close.evaluate((button) => button.scrollIntoView({ block: 'center' }));
  return close;
}

async function firePrompt(page: Page) {
  return page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        (window as unknown as { promptCalls: number }).promptCalls += 1;
      },
    });
    (window as unknown as { promptCalls: number }).promptCalls = 0;
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

const promptCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { promptCalls: number }).promptCalls);

test.describe('iPhone Safari', () => {
  test.use({ userAgent: iPhoneSafari });

  test('shows the steps from the drawer and leaves the page usable', async ({
    page,
  }, testInfo) => {
    mobileOnly(testInfo);
    await page.goto('/');
    const nav = await openNavigation(page);
    const utility = nav.locator('div').filter({ has: addButton(page) });
    await expect(utility.locator(':scope > *').first()).toHaveText('加入主畫面');
    await expect(utility.locator(':scope > *').nth(1)).toHaveText('設定');

    await openGuide(page);
    await expect(guide(page).locator('li')).toHaveCount(3);
    await expect(guide(page)).toContainText('打開為網頁 App');
    await page.getByRole('button', { name: '知道了', exact: true }).tap();
    await expect(guide(page)).toHaveCount(0);

    await openGuide(page);
    await page.keyboard.press('Escape');
    await expect(guide(page)).toHaveCount(0);

    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await page.setViewportSize({ width: 390, height: 300 });
    await page.evaluate(() => window.scrollTo(0, 80));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await openNavigation(page);
    await expect(addButton(page)).toBeVisible();
  });

  test('keeps the dialog inside a 320px phone', async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await openGuide(page);
    await expect(titleOf(page)).toBeInViewport({ ratio: 1 });
    const close = await scrollToClose(page);
    await expect(close).toBeInViewport({ ratio: 1 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('keeps the button reachable by scrolling on a short window', async ({
    page,
  }, testInfo) => {
    mobileOnly(testInfo);
    await page.setViewportSize({ width: 360, height: 480 });
    await page.goto('/');
    await openGuide(page);
    await expect(titleOf(page)).toBeInViewport({ ratio: 1 });
    const close = await scrollToClose(page);
    await expect(close).toBeInViewport({ ratio: 1 });
    await close.tap();
    await expect(guide(page)).toHaveCount(0);
  });
});

test.describe('Android Chrome', () => {
  test.use({ userAgent: androidChrome });

  test('shows the steps when the browser offers no prompt', async ({
    page,
  }, testInfo) => {
    mobileOnly(testInfo);
    await page.goto('/');
    await openGuide(page);
    await expect(guide(page).locator('li')).toHaveCount(3);
    await expect(guide(page)).toContainText('安裝並建立捷徑');
    await expect(guide(page)).not.toContainText('打開為網頁 App');
  });

  test('uses the held prompt once, then the steps', async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    await page.goto('/');
    await openNavigation(page);
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveCount(0);
    expect(await firePrompt(page)).toBe(true);

    await openNavigation(page);
    await addButton(page).tap();
    await expect(drawer(page)).toHaveCount(0);
    await expect(guide(page)).toHaveCount(0);
    expect(await promptCalls(page)).toBe(1);

    await openGuide(page);
    expect(await promptCalls(page)).toBe(1);
  });

  test('drops the button once the app is installed', async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    await page.goto('/');
    await openNavigation(page);
    await expect(addButton(page)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(addButton(page)).toHaveCount(0);
  });
});

test.describe('inside another app', () => {
  test.describe('on Android', () => {
    test.use({ userAgent: androidWebView });

    test('points to Chrome', async ({ page }, testInfo) => {
      mobileOnly(testInfo);
      await page.goto('/');
      await openGuide(page);
      await expect(guide(page)).toContainText('你現在是在其他 App 裡看這個網頁');
      await expect(guide(page)).toContainText('選擇用 Chrome 打開。');
    });
  });

  test.describe('on iOS', () => {
    test.use({ userAgent: iPhoneFacebook });

    test('points to Safari', async ({ page }, testInfo) => {
      mobileOnly(testInfo);
      await page.goto('/');
      await openGuide(page);
      await expect(guide(page)).toContainText('你現在是在其他 App 裡看這個網頁');
      await expect(guide(page)).toContainText('選擇用 Safari 打開。');
    });
  });
});

test.describe('running as an app', () => {
  test.use({ userAgent: iPhoneSafari });

  test('offers nothing', async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === '(display-mode: standalone)'
          ? ({ ...matchMedia(query), matches: true, media: query } as MediaQueryList)
          : matchMedia(query);
      Object.defineProperty(navigator, 'standalone', { value: true });
    });
    await page.goto('/');
    const nav = await openNavigation(page);
    await expect(nav.getByRole('link', { name: '設定', exact: true })).toBeVisible();
    await expect(addButton(page)).toHaveCount(0);
  });
});

test('computers do not get the button', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'computers only');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '主要功能', exact: true });
  // The button only appears after hydration; the settings dialog shows that has happened.
  await expect(async () => {
    await nav.getByRole('link', { name: '設定', exact: true }).click({ timeout: 1000 });
    await expect(page.getByRole('dialog', { name: '設定', exact: true })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  await expect(addButton(page)).toHaveCount(0);
});

test('the manifest and its icons are served', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const { icons } = (await manifest.json()) as { icons: { src: string }[] };
  const appleTouchIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href');
  expect(appleTouchIcon).toBeTruthy();
  for (const src of [...icons.map((icon) => icon.src), appleTouchIcon!]) {
    const response = await request.get(src);
    expect(response.status(), src).toBe(200);
    expect(response.headers()['content-type'], src).toBe('image/png');
  }
});
