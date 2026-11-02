// Draws the Home Screen icons from the sidebar's brand mark. The site has no logo yet.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outputDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/icons',
);

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
const background = '#283f7d';
const foreground = '#fef9f1';

// A maskable icon is cropped to any shape inside the central 80% circle, so its glyph is smaller.
const icons = [
  { file: 'icon-192.png', size: 192, glyphShare: 0.62 },
  { file: 'icon-512.png', size: 512, glyphShare: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, glyphShare: 0.62 },
  { file: 'icon-maskable-512.png', size: 512, glyphShare: 0.5 },
];

function iconSvg(size, glyphShare) {
  const scale = (size * glyphShare) / glyphInkSize;
  const offset = size / 2 - glyphCentre * scale;
  const paths = glyphPaths.map((d) => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${background}"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${foreground}" stroke-width="${glyphStroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
  </svg>`;
}

await mkdir(outputDirectory, { recursive: true });
for (const { file, size, glyphShare } of icons) {
  // The square stays full-bleed and opaque: iOS paints transparency black, and each OS rounds the corners itself.
  await sharp(Buffer.from(iconSvg(size, glyphShare)))
    .removeAlpha()
    .png()
    .toFile(path.join(outputDirectory, file));
}
