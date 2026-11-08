// Draws the Home Screen icons, favicon.ico and the search-result PNG from the sidebar's brand mark. The site has no logo yet.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public',
);
const outputDirectory = path.join(publicDirectory, 'icons');

// Tabler's IconBuildingSkyscraper, on its 24 grid. Its ink spans 3 to 21 on both axes.
const glyphPaths = [
  'M3 21l18 0',
  'M5 21v-14l8 -4v18',
  'M19 21v-10l-6 -4',
  'M9 9l0 .01',
  'M9 12l0 .01',
  'M9 15l0 .01',
  'M9 18l0 .01',
];
const glyphInkSize = 18;
const glyphCentre = 12;
const glyphStroke = 1.9;
// Home Screen icons: the glyph in cream on a blue tile.
const background = '#283f7d';
const foreground = '#fef9f1';
// Tab and search-result icons: the glyph alone, in the sidebar's blue (--primary, light theme), nothing behind it.
const tabInk = '#3157ba';
// With no tile the glyph fills the box as the sidebar's mark does; the pixel glyphs below span about as much.
const tabGlyphShare = 0.8;

// A maskable icon is cropped to any shape inside the central 80% circle, so its glyph is smaller.
const icons = [
  { file: 'icon-192.png', size: 192, glyphShare: 0.62 },
  { file: 'icon-512.png', size: 512, glyphShare: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, glyphShare: 0.62 },
  { file: 'icon-maskable-512.png', size: 512, glyphShare: 0.5 },
];

// Scaled down, the glyph's thin lines and window dots blur, so tab sizes are redrawn in pixels:
// a 2px stroke at 16 and 3px at 32, every straight edge on a pixel boundary, only the roofs smoothed.
// 16 has room for three windows, not four.
const tabGlyphs = {
  16: 'M1 13h14v2H1z M2 13V4h2V3h2V2h2V1h2v12H8V4H6v1H4v8z M10 4h1v1h1v1h1v1h1v6h-2V7h-1V6h-1z M5 6h2v1H5z M5 8h2v1H5z M5 10h2v1H5z',
  32: 'M4 26h25v3H4z M6 26V8l10-5h3v23h-3V6.35l-7 3.5V26z M19 9l8 5.33V26h-3V15.94l-5-3.33z M11 10h3v2h-3z M11 14h3v2h-3z M11 18h3v2h-3z M11 22h3v2h-3z',
};

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

function glyph(size, glyphShare, ink) {
  const scale = (size * glyphShare) / glyphInkSize;
  const offset = size / 2 - glyphCentre * scale;
  const paths = glyphPaths.map((d) => `<path d="${d}"/>`).join('');
  return `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${ink}" stroke-width="${glyphStroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

const iconSvg = (size, glyphShare) =>
  svg(
    size,
    `<rect width="${size}" height="${size}" fill="${background}"/>${glyph(size, glyphShare, foreground)}`,
  );

// Sizes drawn in pixels use that drawing; the others scale the glyph.
const tabIconSvg = (size) =>
  svg(
    size,
    size in tabGlyphs
      ? `<path d="${tabGlyphs[size]}" fill="${tabInk}"/>`
      : glyph(size, tabGlyphShare, tabInk),
  );

// An ICO is a directory of images; modern readers take PNGs inside it.
function ico(frames) {
  const directory = Buffer.alloc(6 + 16 * frames.length);
  directory.writeUInt16LE(1, 2); // type 1: icon
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    directory.writeUInt8(size, entry);
    directory.writeUInt8(size, entry + 1);
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([directory, ...frames.map(({ png }) => png)]);
}

await mkdir(outputDirectory, { recursive: true });
for (const { file, size, glyphShare } of icons) {
  // The square stays full-bleed and opaque: iOS paints transparency black, and each OS rounds the corners itself.
  await sharp(Buffer.from(iconSvg(size, glyphShare)))
    .removeAlpha()
    .png()
    .toFile(path.join(outputDirectory, file));
}

// Browsers pick 16 or 32 for a tab by screen sharpness; 48 is the normal drawing.
// Around the glyph the frames are transparent, so they keep their alpha channel.
const faviconFrames = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    png: await sharp(Buffer.from(tabIconSvg(size)))
      .ensureAlpha()
      .png()
      .toBuffer(),
  })),
);
await writeFile(path.join(publicDirectory, 'favicon.ico'), ico(faviconFrames));

// Google wants a square of at least 48 beside its results, and browsers that take the largest icon get this one.
await sharp(Buffer.from(tabIconSvg(192)))
  .png()
  .toFile(path.join(outputDirectory, 'favicon-192.png'));
