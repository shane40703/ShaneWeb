import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAILY_STAGES, getDailyStageTheme } from './daily-practice';

describe('simplified daily boss sprites', () => {
  it.each(['law', 'env', 'construction', 'structure'] as const)('provides six small, crisp, limited-palette %s sprites', subject => {
    const sprites = DAILY_STAGES.map((_, index) => getDailyStageTheme(subject, index).sprite);
    expect(new Set(sprites).size).toBe(6);
    for (const sprite of sprites) {
      const svg = readFileSync(`public${sprite}`, 'utf8');
      expect(svg).toContain('viewBox="0 0 32 32"');
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain('<title>');
      expect(svg).not.toMatch(/<(filter|image|linearGradient|radialGradient|script)\b/);
      expect(new Set(svg.match(/#[\da-f]{6}/gi)).size).toBeLessThanOrEqual(5);
      expect(Buffer.byteLength(svg)).toBeLessThan(1200);
    }
  });
});
