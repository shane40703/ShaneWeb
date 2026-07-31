import { describe, expect, it } from 'vitest';
import {
  findOfficialThemePreset,
  OFFICIAL_THEME_PRESETS,
  themePalettesMatch,
} from './theme-presets';
import {
  DEFAULT_THEME_PALETTES,
  deriveThemeTokens,
  parseStoredThemeColors,
  serializeStoredThemeColors,
  THEME_PALETTE_FIELDS,
  THEME_CUSTOM_PROPERTIES,
  validateThemePalette,
} from './theme';

describe('official theme presets', () => {
  it('offers exactly five valid, distinct palettes for each appearance mode', () => {
    const ids = new Set<string>();

    for (const mode of ['light', 'dark'] as const) {
      const presets = OFFICIAL_THEME_PRESETS[mode];
      expect(presets).toHaveLength(5);
      expect(new Set(presets.map(({ name }) => name)).size).toBe(5);
      expect(new Set(presets.map(({ palette }) => JSON.stringify(palette))).size).toBe(5);

      for (const preset of presets) {
        expect(ids.has(preset.id)).toBe(false);
        ids.add(preset.id);
        expect(Object.keys(preset.palette).sort()).toEqual(
          [...THEME_PALETTE_FIELDS].sort(),
        );
        expect(validateThemePalette(mode, preset.palette)).toEqual({
          valid: true,
          invalidFields: [],
          issues: [],
        });
        expect(Object.keys(deriveThemeTokens(mode, preset.palette))).toEqual(
          THEME_CUSTOM_PROPERTIES,
        );
      }
    }
  });

  it('uses the existing baseline as the first official palette in each mode', () => {
    expect(OFFICIAL_THEME_PRESETS.light[0].palette).toEqual(
      DEFAULT_THEME_PALETTES.light,
    );
    expect(OFFICIAL_THEME_PRESETS.dark[0].palette).toEqual(
      DEFAULT_THEME_PALETTES.dark,
    );
  });

  it('matches palettes without depending on hexadecimal letter case', () => {
    const preset = OFFICIAL_THEME_PRESETS.light[1];
    const lowerCasePalette = Object.fromEntries(
      Object.entries(preset.palette).map(([field, value]) => [
        field,
        value.toLowerCase(),
      ]),
    ) as typeof preset.palette;

    expect(themePalettesMatch(preset.palette, lowerCasePalette)).toBe(true);
    expect(findOfficialThemePreset('light', lowerCasePalette)?.id).toBe(
      preset.id,
    );
    expect(findOfficialThemePreset('dark', lowerCasePalette)).toBeUndefined();
  });

  it('round-trips official choices through the existing storage schema', () => {
    const light = OFFICIAL_THEME_PRESETS.light[3].palette;
    const dark = OFFICIAL_THEME_PRESETS.dark[4].palette;

    expect(
      parseStoredThemeColors(serializeStoredThemeColors({ light, dark })),
    ).toEqual({
      version: 1,
      palettes: { light, dark },
    });
  });
});
