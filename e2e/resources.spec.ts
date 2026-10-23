import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { MemoryGalleryImage } from '../src/lib/memory-gallery';

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

async function closeNavigation(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
    0,
  );
}

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

const overview = {
  questions: { total: 120, subjectCount: 3, firstYear: 110, lastYear: 114 },
  gallery: {
    total: 3,
    latest: ['構造測試圖一', '法規測試圖', '構造測試圖二'].map((title, index) => {
      const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      return {
        id,
        title,
        thumbnailSrc: `/memory-gallery/assets/${id}-thumb.webp`,
        width: 700,
        height: 900,
      };
    }),
  },
  laws: {
    total: 2,
    top: [
      { name: '建築法', questionCount: 12 },
      { name: '建築技術規則', questionCount: 9 },
    ],
  },
};

/** Opens the hub through the sidebar so its data request can be replaced by `overview`. */
async function enterHubWithFixture(page: Page, isMobile: boolean) {
  const image = await sharp({
    create: { width: 700, height: 900, channels: 3, background: '#dbe7fb' },
  })
    .png()
    .toBuffer();
  await page.route('**/memory-gallery/assets/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: image }),
  );
  await page.route('**/_next/data/**/resources.json*', (route) =>
    route.fulfill({ json: { pageProps: { overview }, __N_SSG: true } }),
  );
  await page.goto('/');
  await (
    await openNavigation(page)
  )
    .getByRole('link', { name: '統計分析', exact: true })
    .click();
  await expect(page).toHaveURL(/\/resources$/);
  await closeNavigation(page, isMobile);
}

test('the resources hub opens from the sidebar and reaches every resource page', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/');
  await (
    await openNavigation(page)
  )
    .getByRole('link', { name: '統計分析', exact: true })
    .click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(page).toHaveTitle('統計分析｜建築師考試');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('統計分析');
  await expect(page.getByRole('dialog', { name: '主要功能', exact: true })).toHaveCount(
    0,
  );

  const sections = page.getByRole('navigation', { name: '統計分析頁面' });
  await expect(sections.getByRole('link', { name: '總覽' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.locator('main h2')).toHaveText([
    '考題分析',
    '速記圖庫',
    '法規資料庫',
  ]);
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: testInfo.outputPath('resources-hub.png'),
    fullPage: true,
  });

  await page.getByRole('article', { name: '考題分析' }).getByRole('link').click();
  await expect(page).toHaveURL(/\/resources\/analysis(\?.*)?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('考題分析');
  await expect(sections.getByRole('link', { name: '考題分析' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    (await openNavigation(page)).getByRole('link', {
      name: '統計分析',
      exact: true,
    }),
  ).toHaveAttribute('aria-current', 'page');
  await closeNavigation(page, isMobile);
  await expectNoHorizontalScroll(page);

  // The switcher moves sideways without a trip back to the hub.
  await sections.getByRole('link', { name: '法規資料庫' }).click();
  await expect(page).toHaveURL(/\/resources\/laws$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('法規資料庫');
  const laws = page.getByRole('region', { name: '法規資料庫' });
  await expect(laws.getByRole('link').first()).toHaveAttribute(
    'href',
    /law\.moj\.gov\.tw/,
  );
  await expect(laws.getByRole('heading')).toHaveCount(0);

  await sections.getByRole('link', { name: '速記圖庫' }).click();
  await expect(page).toHaveURL(/\/resources\/memory-gallery$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('速記圖庫');
  await expect(
    page
      .getByRole('region', { name: '速記圖庫' })
      .getByRole('group', { name: '圖片分類' }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('resources-gallery.png') });

  await sections.getByRole('link', { name: '總覽' }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('hub cards describe and preview each resource, with no links of their own', async ({
  page,
  isMobile,
}) => {
  await enterHubWithFixture(page, isMobile);

  const analysis = page.getByRole('article', { name: '考題分析' });
  await expect(analysis.getByText('3 科・110–114 年')).toBeVisible();
  await expect(
    analysis.getByText('選科目與年度，查看命題分布、歷年趨勢與對應考古題。'),
  ).toBeVisible();
  const gallery = page.getByRole('article', { name: '速記圖庫' });
  await expect(gallery.getByRole('img')).toHaveCount(3);
  const laws = page.getByRole('article', { name: '法規資料庫' });
  await expect(laws.getByRole('listitem')).toHaveCount(2);
  await expect(laws.getByRole('listitem').first()).toContainText('建築法 12 題');

  // Each card's title is its only link, and nothing leads off the site.
  for (const card of [analysis, gallery, laws]) {
    await expect(card.getByRole('link')).toHaveCount(1);
  }
  await expect(page.locator('a[href*="law.moj.gov.tw"]')).toHaveCount(0);
  expect(
    await gallery
      .getByRole('img')
      .first()
      .evaluate(
        (image) =>
          !image.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
          ),
      ),
  ).toBe(true);

  // A click on a preview belongs to its card: it opens the gallery, not that one image.
  const preview = gallery.getByRole('img').nth(1);
  await preview.scrollIntoViewIfNeeded();
  const box = (await preview.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/resources\/memory-gallery$/);
});

test('a gallery subject page is prerendered with only its own images', async ({
  browser,
  baseURL,
}) => {
  const { items } = JSON.parse(await readFile('data/memory-gallery.json', 'utf8')) as {
    items: MemoryGalleryImage[];
  };
  const construction = items.filter(
    (item) => !item.archivedAt && item.category === 'construction',
  );
  // Without scripts the page shows exactly what its HTML holds, before any hydration.
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/resources/memory-gallery/construction`);
    await expect(
      page.getByRole('group', { name: '圖片分類' }).getByRole('link', { name: /^構造/ }),
    ).toHaveAttribute('aria-current', 'page');
    const sources = await page
      .locator('img[src*="/memory-gallery/assets/"]')
      .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
    expect(sources.sort()).toEqual(construction.map((item) => item.src).sort());
  } finally {
    await context.close();
  }
});

test('the whole card opens its resource page and its title shows a focus ring', async ({
  page,
  isMobile,
}) => {
  await enterHubWithFixture(page, isMobile);

  const card = page.getByRole('article', { name: '法規資料庫' });
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  // The footer holds no shortcut, so a click there belongs to the card itself. Aim at the
  // middle to stay clear of the dev-mode indicator pinned to the bottom-left corner.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 18);
  await expect(page).toHaveURL(/\/resources\/laws$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/resources$/);
  const title = page
    .getByRole('article', { name: '速記圖庫' })
    .getByRole('link', { name: '速記圖庫', exact: true });
  // Arrive by keyboard: after the mouse click above, scripted focus alone is not focus-visible.
  await title.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((link) => getComputedStyle(link, '::after').outlineStyle),
  ).not.toBe('none');

  // The switcher's current link has a solid fill, so its ring must be another colour.
  const current = page
    .getByRole('navigation', { name: '統計分析頁面' })
    .getByRole('link', { name: '總覽' });
  await current.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(current).toBeFocused();
  const ring = await current.evaluate((link) => {
    const style = getComputedStyle(link);
    return {
      width: style.outlineWidth,
      colour: style.outlineColor,
      fill: style.backgroundColor,
    };
  });
  expect(ring.width).not.toBe('0px');
  expect(ring.colour).not.toBe(ring.fill);
});

test('on a 320px phone the title, menu button and switcher stay in the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/resources');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText('統計分析');
  expect(
    (await page.getByRole('button', { name: '開啟選單' }).boundingBox())!.width,
  ).toBeGreaterThanOrEqual(40);
  const switcher = (await page
    .getByRole('navigation', { name: '統計分析頁面' })
    .boundingBox())!;
  expect(switcher.x + switcher.width).toBeLessThanOrEqual(320 - 16 + 0.5);
  await expectNoHorizontalScroll(page);
});

test('law rows fit tablet-width panels', async ({ page }) => {
  // 600px has no sidebar and 900px sits beside it; both leave under 620px for a row.
  for (const width of [600, 900]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/resources/laws');
    await expect(page.getByRole('link', { name: /建築技術規則/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test('the sidebar shows the full hub name', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The phone drawer is wide enough for the name on one line.');
  await page.goto('/resources');
  const label = page
    .getByRole('navigation', { name: '主要功能', exact: true })
    .getByRole('link', { name: '統計分析', exact: true })
    .locator(':scope > span')
    .last();
  const size = await label.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
});
