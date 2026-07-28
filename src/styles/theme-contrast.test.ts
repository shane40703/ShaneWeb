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
    [...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(
      ([, name, value]) => [name, value],
    ),
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

const textPairs = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text-soft', '--surface'],
  ['--muted', '--surface'],
  ['--muted', '--surface-2'],
  ['--subtle-text', '--surface'],
  ['--primary-strong', '--primary-soft'],
  ['--success', '--success-soft'],
  ['--danger', '--danger-soft'],
  ['--warning', '--warning-soft'],
  ['--purple', '--purple-soft'],
  ['--neutral-text', '--neutral-fill'],
  ['--disabled-text', '--surface'],
  ['--sidebar-text', '--sidebar-surface'],
  ['--sidebar-muted', '--sidebar-surface'],
  ['--on-primary', '--primary-solid'],
  ['--on-primary', '--primary-solid-hover'],
  ['--on-success', '--success-solid'],
] as const;

const controlPairs = [
  ['--control-line', '--surface'],
  ['--control-line', '--surface-2'],
  ['--control-line', '--neutral-fill'],
  ['--focus', '--surface'],
  ['--focus', '--surface-2'],
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

  it.each(textPairs)('%s remains readable on %s', (foreground, background) => {
    expect(tokens[foreground]).toBeDefined();
    expect(tokens[background]).toBeDefined();
    expect(
      contrastRatio(tokens[foreground], tokens[background]),
      `${foreground} on ${background}`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(controlPairs)(
    '%s remains visible on %s',
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

describe('selected question number colors', () => {
  it('uses the tested solid-primary foreground and background pair', () => {
    const activeRule = questionNumberCss.match(
      /\.button\[aria-current='step'\],[\s\S]*?\.button\[aria-pressed='true'\]\s*\{([\s\S]*?)\}/,
    )?.[1];

    expect(activeRule).toContain('background: var(--primary-solid)');
    expect(activeRule).toContain('color: var(--on-primary)');
  });
});
