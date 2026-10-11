import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { DAILY_STAGES, getDailyStageTheme } from './daily-practice';

describe('Japanese pixel daily boss sprites', () => {
  it.each(['law', 'env', 'construction', 'structure'] as const)('provides six alpha-safe, uniformly framed %s sprites', async subject => {
    const sprites = DAILY_STAGES.map((_, index) => getDailyStageTheme(subject, index).sprite);
    expect(new Set(sprites).size).toBe(6);
    for (const sprite of sprites) {
      expect(sprite).toMatch(/-v5\.webp$/);
      const asset = readFileSync(`public${sprite}`);
      expect(asset.byteLength).toBeLessThan(300_000);
      expect(await sharp(asset).metadata()).toMatchObject({
        format: 'webp', width: 384, height: 384, hasAlpha: true,
      });
      const { data, info } = await sharp(asset).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
      // A shared transparent gutter protects the silhouette from cropping and background halos.
      for (let x = 0; x < info.width; x++) {
        expect(alphaAt(x, 0)).toBe(0);
        expect(alphaAt(x, info.height - 1)).toBe(0);
      }
      for (let y = 0; y < info.height; y++) {
        expect(alphaAt(0, y)).toBe(0);
        expect(alphaAt(info.width - 1, y)).toBe(0);
      }
      expect((await sharp(asset).stats()).channels[3].max).toBe(255);
      const original = sprite.replace('/daily-game/', 'public/daily-game/source-1.65-jp/').replace('-v5.webp', '.png');
      expect(await sharp(readFileSync(original)).metadata()).toMatchObject({ format: 'png', hasAlpha: true });
    }
  });

  it('keeps every subject boss distinct while reusing construction sprites for structure', () => {
    const sprites = ['law', 'env', 'construction'].flatMap(subject =>
      DAILY_STAGES.map((_, index) => getDailyStageTheme(subject as 'law' | 'env' | 'construction', index).sprite),
    );
    expect(new Set(sprites.map(sprite => readFileSync(`public${sprite}`).toString('base64'))).size).toBe(18);
    expect(DAILY_STAGES.map((_, index) => getDailyStageTheme('structure', index).sprite))
      .toEqual(DAILY_STAGES.map((_, index) => getDailyStageTheme('construction', index).sprite));
  });
});
