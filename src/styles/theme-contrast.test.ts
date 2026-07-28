import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/globals.css', 'utf8');
const questionNumberCss = readFileSync(
  'src/components/question-number-button.module.css',
  'utf8',
);
const quizCss = readFileSync('src/features/quiz/quiz-page.module.css', 'utf8');

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
      '--bg': '#f3f7fc',
      '--surface': '#ffffff',
      '--surface-2': '#f8fbff',
      '--surface-3': '#e9f0f8',
      '--text': '#14213d',
      '--text-soft': '#34425b',
      '--muted': '#6c7890',
      '--line': '#dde6f1',
      '--control-line': '#dde6f1',
      '--primary': '#2563eb',
      '--primary-strong': '#1d4ed8',
      '--primary-soft': '#edf4ff',
      '--primary-solid': '#2563eb',
      '--primary-solid-hover': '#1d4ed8',
      '--primary-solid-gradient': '#4d8cff',
      '--on-primary': '#ffffff',
      '--success': '#13865c',
      '--success-soft': '#e6f8f0',
      '--success-solid': '#13865c',
      '--on-success': '#ffffff',
      '--danger': '#c63838',
      '--danger-soft': '#fff0f0',
      '--warning': '#b66a0c',
      '--warning-soft': '#fff6e5',
      '--purple': '#7c4bd4',
      '--purple-soft': '#f2ebff',
      '--neutral-fill': '#f5f5f7',
      '--neutral-text': '#3a3a3c',
      '--disabled-text': '#98a1ad',
      '--sidebar-surface': '#fafafa',
      '--sidebar-text': 'rgb(0 0 0 / 88%)',
      '--sidebar-muted': 'rgb(0 0 0 / 50%)',
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

  it('does not rely on the quiz card scoped accent variable', () => {
    const navigatorActiveRule = quizCss.match(
      /\.questionNumbers a\[aria-current='step'\]\s*\{([\s\S]*?)\}/,
    )?.[1];

    expect(navigatorActiveRule).toContain(
      'background: var(--primary-solid)',
    );
    expect(navigatorActiveRule).toContain('color: var(--on-primary)');
    expect(navigatorActiveRule).not.toContain('var(--quiz-accent)');
  });
});
