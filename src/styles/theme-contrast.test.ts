import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/globals.css', 'utf8');
const questionNumberCss = readFileSync(
  'src/components/question-number-button.module.css',
  'utf8',
);

function themeTokens(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = css.match(
    new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`),
  )?.[1];

  if (!block) throw new Error(`Missing theme block: ${selector}`);

  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/gi)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  );
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

const primaryTextPairs = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text-soft', '--surface'],
  ['--text-soft', '--surface-2'],
  ['--subtle-text', '--surface'],
  ['--primary-strong', '--primary-soft'],
  ['--danger', '--danger-soft'],
  ['--purple', '--purple-soft'],
  ['--neutral-text', '--neutral-fill'],
  ['--on-primary', '--primary-solid'],
  ['--on-primary', '--primary-solid-hover'],
  ['--on-success', '--success-solid'],
] as const;

const secondaryTextPairs = [
  ['--muted', '--surface'],
  ['--muted', '--surface-2'],
  ['--success', '--success-soft'],
  ['--warning', '--warning-soft'],
] as const;

const chartTokens = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
] as const;

describe.each([
  ['light', ':root'],
  ['dark', ":root[data-theme='dark']"],
])('%s theme contrast', (_, selector) => {
  const tokens = themeTokens(selector);

  it.each(primaryTextPairs)(
    '%s remains readable on %s',
    (foreground, background) => {
      expect(tokens[foreground]).toBeDefined();
      expect(tokens[background]).toBeDefined();
      expect(
        contrastRatio(tokens[foreground], tokens[background]),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(secondaryTextPairs)(
    '%s remains distinct on %s',
    (foreground, background) => {
      expect(tokens[foreground]).toBeDefined();
      expect(tokens[background]).toBeDefined();
      expect(
        contrastRatio(tokens[foreground], tokens[background]),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(chartTokens)('%s remains visible on chart cards', (foreground) => {
    expect(tokens[foreground]).toBeDefined();
    expect(
      contrastRatio(tokens[foreground], tokens['--surface']),
      `${foreground} on --surface`,
    ).toBeGreaterThanOrEqual(3);
  });
});

describe('light theme visual baseline', () => {
  const tokens = themeTokens(':root');

  it('preserves the established light palette', () => {
    expect(tokens).toMatchObject({
      '--bg': '#eadfc9',
      '--grid-line': '#d3c9b5',
      '--grid-line-soft': '#e3d9c3',
      '--surface': '#fef9f1',
      '--surface-2': '#f6edda',
      '--surface-3': '#e2d6bc',
      '--text': '#373737',
      '--text-soft': '#4f4f4f',
      '--muted': '#636363',
      '--line': '#cfc5ae',
      '--line-strong': '#6b665d',
      '--control-line': '#a39b8c',
      '--primary': '#3157ba',
      '--primary-strong': '#283f7d',
      '--primary-soft': '#e2e6f2',
      '--primary-solid': '#283f7d',
      '--primary-solid-hover': '#1f396c',
      '--primary-solid-gradient': '#283f7d',
      '--on-primary': '#ffffff',
      '--success': '#176840',
      '--success-soft': '#e1eedd',
      '--success-solid': '#176840',
      '--on-success': '#ffffff',
      '--danger': '#b03527',
      '--danger-soft': '#fae7e1',
      '--warning': '#875009',
      '--warning-soft': '#f7e8cc',
      '--purple': '#5f41ab',
      '--purple-soft': '#ece6f4',
      '--neutral-fill': '#f0e7d4',
      '--neutral-text': '#3a3a3a',
      '--disabled-text': '#8a8479',
      '--sidebar-surface': '#fef9f1',
      '--sidebar-text': '#373737',
      '--sidebar-muted': '#636363',
    });
  });
});

describe('selected question number colors', () => {
  it('uses the tested solid-primary foreground and background pair', () => {
    const activeRule = questionNumberCss.match(
      /\.button\[aria-current='step'\],[\s\S]*?\.button\[aria-pressed='true'\]\s*\{([\s\S]*?)\}/,
    )?.[1];

    expect(activeRule).toContain('background: var(--primary-solid)');
    expect(activeRule).toContain('color: var(--on-primary)');
  });
});
