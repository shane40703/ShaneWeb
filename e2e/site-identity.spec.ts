import { expect, test, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

const SITE_NAME = '建築師大集結';

/**
 * Google names a site in its results from the home page: the WebSite data first, then
 * og:site_name, its title and other text it shows, such as the sidebar's brand, and shows the icon
 * its head links to. It reads the HTML the server sends, so these checks run no scripts.
 */
const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: 'exam-tw.vercel.app',
  url: 'https://exam-tw.vercel.app/',
};
const innerPages = ['/exams/law/114/3', '/practice'];

async function htmlOf(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  const html = await response.text();
  return { html, head: html.split('</head>')[0] };
}

const structuredData = (html: string) =>
  [
    ...html.matchAll(
      /<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((match) => JSON.parse(match[1]) as Record<string, unknown>);

const attribute = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const siteNames = (head: string) =>
  [...head.matchAll(/<meta\b[^>]*\bproperty="og:site_name"[^>]*>/g)].map((match) =>
    attribute(match[0], 'content'),
  );

const titles = (head: string) =>
  [...head.matchAll(/<title\b[^>]*>([^<]*)<\/title>/g)].map((match) => match[1]);

const homeScreenNames = (head: string) =>
  [...head.matchAll(/<meta\b[^>]*\bname="apple-mobile-web-app-title"[^>]*>/g)].map(
    (match) => attribute(match[0], 'content'),
  );

/** Every link to the home page, its accessible name and the text it shows. */
const homeLinks = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter((match) => attribute(match[1], 'href') === '/')
    .map((match) => ({
      label: attribute(match[1], 'aria-label'),
      text: match[2].replace(/<[^>]*>/g, ''),
    }));

/** The images inside an ICO, each with the size its directory claims. */
const icoFrames = (ico: Buffer) =>
  Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index;
    const offset = ico.readUInt32LE(entry + 12);
    return {
      width: ico[entry] || 256,
      height: ico[entry + 1] || 256,
      image: ico.subarray(offset, offset + ico.readUInt32LE(entry + 8)),
    };
  });

test.describe('site name and icon', () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== 'desktop',
      'the server sends every device the same page',
    ),
  );

  test('the home page names the site once, in its head', async ({ request }) => {
    const { html, head } = await htmlOf(request, '/');
    expect(structuredData(html)).toEqual([website]);
    expect(structuredData(head)).toEqual([website]);
    expect(siteNames(head)).toEqual([SITE_NAME]);
  });

  for (const path of innerPages) {
    test(`${path} carries the site name but no WebSite data`, async ({ request }) => {
      const { html, head } = await htmlOf(request, path);
      expect(structuredData(html).filter((data) => data['@type'] === 'WebSite')).toEqual(
        [],
      );
      expect(siteNames(head)).toEqual([SITE_NAME]);
    });
  }

  test('the home tab and the Home Screen icon carry the site name', async ({
    request,
  }) => {
    const { head } = await htmlOf(request, '/');
    expect(titles(head)).toEqual(['建築師大集結｜建築師考試考古題練習平台']);
    expect(homeScreenNames(head)).toEqual([SITE_NAME]);
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      name: SITE_NAME,
      short_name: SITE_NAME,
    });
  });

  for (const path of ['/', ...innerPages]) {
    test(`${path} shows the site name in the sidebar the server sends`, async ({
      request,
    }) => {
      const { html } = await htmlOf(request, path);
      expect(homeLinks(html)).toContainEqual({
        label: `${SITE_NAME}首頁`,
        text: `${SITE_NAME}考古題練習平台`,
      });
    });
  }

  test('every icon the home page links to is served as an image', async ({ request }) => {
    const { head } = await htmlOf(request, '/');
    const hrefs = [...head.matchAll(/<link\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) =>
        (attribute(tag, 'rel') ?? '')
          .split(/\s+/)
          .some((rel) => rel === 'icon' || rel === 'apple-touch-icon'),
      )
      .map((tag) => attribute(tag, 'href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/favicon.ico',
        '/icons/favicon-192.png',
        '/icons/apple-touch-icon.png',
      ]),
    );
    for (const href of hrefs) {
      const response = await request.get(href!);
      expect(response.status(), href).toBe(200);
      expect(response.headers()['content-type'], href).toMatch(/^image\//);
    }
  });

  test('/favicon.ico holds square 16, 32 and 48 pixel frames', async ({ request }) => {
    const response = await request.get('/favicon.ico');
    expect(response.status()).toBe(200);
    const ico = await response.body();
    expect(ico.readUInt16LE(0), 'reserved').toBe(0);
    expect(ico.readUInt16LE(2), 'type: icon').toBe(1);
    const frames = icoFrames(ico).map(({ width, height, image }) => ({
      width,
      height,
      // A PNG frame's own header must agree with its directory entry.
      png: image.subarray(1, 4).toString('latin1') === 'PNG' && {
        width: image.readUInt32BE(16),
        height: image.readUInt32BE(20),
      },
    }));
    expect(frames.toSorted((a, b) => a.width - b.width)).toEqual(
      [16, 32, 48].map((size) => ({
        width: size,
        height: size,
        png: { width: size, height: size },
      })),
    );
  });

  test('tab and search-result icons are the building alone, nothing behind it', async ({
    request,
  }) => {
    const ico = await (await request.get('/favicon.ico')).body();
    const png = await (await request.get('/icons/favicon-192.png')).body();
    for (const image of [...icoFrames(ico).map((frame) => frame.image), png]) {
      const { data, info } = await sharp(image)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const pixel = (x: number, y: number) => {
        const at = (y * info.width + x) * 4;
        return [...data.subarray(at, at + 4)];
      };
      const last = info.width - 1;
      for (const [x, y] of [
        [0, 0],
        [last, 0],
        [0, last],
        [last, last],
      ]) {
        expect(pixel(x, y)[3], `${info.width}px: corner ${x},${y} shows through`).toBe(0);
      }
      // The ground line under the building, in the sidebar's blue.
      expect(
        pixel(Math.floor(info.width / 2), Math.floor(info.height * 0.9)),
        `${info.width}px: ground line`,
      ).toEqual([49, 87, 186, 255]);
    }
  });
});
