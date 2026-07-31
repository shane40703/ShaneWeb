import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemeToDocument,
  contrastRatio,
  DEFAULT_THEME_PALETTES,
  deriveThemeTokens,
  isHexColor,
  isThemePalette,
  parseStoredThemeColors,
  readStoredThemeColors,
  serializeStoredThemeColors,
  THEME_COLORS_STORAGE_KEY,
  THEME_CUSTOM_PROPERTIES,
  THEME_INITIALIZATION_SCRIPT,
  THEME_MODE_STORAGE_KEY,
  themePaletteForMode,
  type ThemePalette,
  validateThemePalette,
} from './theme';

const customLightPalette: ThemePalette = {
  background: '#f5f1e8',
  surface: '#fffaf3',
  text: '#182333',
  muted: '#596575',
  accent: '#1356c4',
  border: '#c9d1dc',
};

const customDarkPalette: ThemePalette = {
  background: '#101722',
  surface: '#182334',
  text: '#edf3fb',
  muted: '#a8b4c5',
  accent: '#83b9ff',
  border: '#34445b',
};

function runInitializationScript() {
  Function(THEME_INITIALIZATION_SCRIPT)();
}

function mockSystemTheme(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#000000';
  meta.dataset.themeTest = 'true';
  document.head.append(meta);
});

afterEach(() => {
  const root = document.documentElement;
  for (const property of THEME_CUSTOM_PROPERTIES) root.style.removeProperty(property);
  root.style.removeProperty('--danger');
  root.style.removeProperty('color-scheme');
  root.removeAttribute('data-theme');
  document.querySelector('meta[data-theme-test="true"]')?.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('theme color storage schema', () => {
  it('accepts only complete six-digit hexadecimal colors', () => {
    expect(isHexColor('#00aAFF')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor(' #ffffff')).toBe(false);
    expect(isHexColor('#ffffff;--danger:red')).toBe(false);
    expect(isHexColor('rgb(0 0 0)')).toBe(false);
    expect(isThemePalette(customLightPalette)).toBe(true);
    expect(isThemePalette({ ...customLightPalette, unexpected: '#000000' })).toBe(false);
  });

  it('treats malformed JSON and unsupported versions as empty', () => {
    expect(parseStoredThemeColors('{bad json')).toEqual({ version: 1, palettes: {} });
    expect(
      parseStoredThemeColors(
        JSON.stringify({ version: 2, palettes: { light: customLightPalette } }),
      ),
    ).toEqual({ version: 1, palettes: {} });
    expect(parseStoredThemeColors(null)).toEqual({ version: 1, palettes: {} });
  });

  it('drops an invalid mode atomically while preserving the other mode', () => {
    const injectedDark = {
      ...customDarkPalette,
      accent: '#83b9ff;--bg:#000000',
    };
    const parsed = parseStoredThemeColors(
      JSON.stringify({
        version: 1,
        palettes: { light: customLightPalette, dark: injectedDark },
      }),
    );

    expect(parsed).toEqual({
      version: 1,
      palettes: { light: customLightPalette },
    });
  });

  it('drops a stored low-contrast mode while preserving a readable mode', () => {
    const parsed = parseStoredThemeColors(
      JSON.stringify({
        version: 1,
        palettes: {
          light: {
            background: '#ffffff',
            surface: '#ffffff',
            text: '#eeeeee',
            muted: '#dddddd',
            accent: '#cccccc',
            border: '#bbbbbb',
          },
          dark: customDarkPalette,
        },
      }),
    );

    expect(parsed).toEqual({
      version: 1,
      palettes: { dark: customDarkPalette },
    });
  });

  it('serializes only valid palettes with the versioned envelope', () => {
    expect(
      serializeStoredThemeColors({ light: customLightPalette, dark: customDarkPalette }),
    ).toBe(
      JSON.stringify({
        version: 1,
        palettes: { light: customLightPalette, dark: customDarkPalette },
      }),
    );

    const serialized = serializeStoredThemeColors({
      version: 1,
      palettes: {
        light: customLightPalette,
        dark: { ...customDarkPalette, border: 'transparent' } as ThemePalette,
      },
    });
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      palettes: { light: customLightPalette },
    });
  });

  it('falls back per mode and never exposes mutable default objects', () => {
    const first = themePaletteForMode({ light: customLightPalette }, 'dark');
    first.background = '#000000';

    expect(themePaletteForMode(undefined, 'dark')).toEqual(
      DEFAULT_THEME_PALETTES.dark,
    );
    expect(themePaletteForMode({ light: customLightPalette }, 'light')).toEqual(
      customLightPalette,
    );
  });

  it('treats storage read failures as an empty color store', () => {
    expect(
      readStoredThemeColors({
        getItem() {
          throw new DOMException('blocked', 'SecurityError');
        },
      }),
    ).toEqual({ version: 1, palettes: {} });
  });
});

describe('contrast validation and derived tokens', () => {
  it('calculates WCAG contrast ratios and keeps the 4.5 boundary precise', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(() => contrastRatio('#fff', '#ffffff')).toThrow(TypeError);
  });

  it('checks text and accent at 4.5 and muted text at 3 on every surface', () => {
    expect(validateThemePalette('light', DEFAULT_THEME_PALETTES.light)).toEqual({
      valid: true,
      invalidFields: [],
      issues: [],
    });
    expect(validateThemePalette('dark', DEFAULT_THEME_PALETTES.dark).valid).toBe(true);

    const invalid = validateThemePalette('light', {
      ...DEFAULT_THEME_PALETTES.light,
      accent: '#777777',
      muted: '#aaaaaa',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          foreground: 'accent',
          background: 'surface',
          minimum: 4.5,
        }),
        expect.objectContaining({
          foreground: 'muted',
          background: 'surface2',
          minimum: 3,
        }),
      ]),
    );
  });

  it('reports invalid fields without attempting unsafe color math', () => {
    const validation = validateThemePalette('light', {
      ...customLightPalette,
      accent: '#1356c4;--bg:#000000',
    });

    expect(validation).toEqual({
      valid: false,
      invalidFields: ['accent'],
      issues: [],
    });
  });

  it('derives exactly the whitelisted variables and preserves all six inputs', () => {
    const tokens = deriveThemeTokens('light', customLightPalette);

    expect(Object.keys(tokens)).toEqual(THEME_CUSTOM_PROPERTIES);
    expect(tokens).toMatchObject({
      '--bg': customLightPalette.background,
      '--surface': customLightPalette.surface,
      '--text': customLightPalette.text,
      '--muted': customLightPalette.muted,
      '--primary': customLightPalette.accent,
      '--line': customLightPalette.border,
      '--control-line': customLightPalette.border,
      '--chart-1': customLightPalette.accent,
      '--subject-blue': customLightPalette.accent,
    });
    expect(tokens['--surface-2']).toMatch(/^#[0-9a-f]{6}$/);
    expect(tokens['--primary-soft']).toMatch(/^#[0-9a-f]{6}$/);
    expect(
      contrastRatio(tokens['--on-primary'], tokens['--primary-solid']),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('reproduces the existing baseline tokens when a default palette is applied', () => {
    const light = deriveThemeTokens('light', DEFAULT_THEME_PALETTES.light);
    const dark = deriveThemeTokens('dark', DEFAULT_THEME_PALETTES.dark);

    expect(light).toMatchObject({
      '--surface-2': '#f8fbff',
      '--text-soft': '#34425b',
      '--primary-solid-hover': '#1d4ed8',
      '--sidebar-surface': '#fafafa',
    });
    expect(dark).toMatchObject({
      '--surface-2': '#172238',
      '--text-soft': '#c0ccdc',
      '--primary-solid': '#3b6fd8',
      '--subject-blue': '#7db1ff',
    });
  });

  it('keeps every accent-derived baseline token stable when only dark background changes', () => {
    const baseline = deriveThemeTokens('dark', DEFAULT_THEME_PALETTES.dark);
    const changed = deriveThemeTokens('dark', {
      ...DEFAULT_THEME_PALETTES.dark,
      background: '#070b16',
    });
    const accentDerivedProperties = [
      '--primary',
      '--primary-strong',
      '--primary-bright',
      '--primary-soft',
      '--primary-solid',
      '--primary-solid-hover',
      '--primary-solid-gradient',
      '--on-primary',
      '--focus',
      '--chart-1',
      '--subject-blue',
    ] as const;

    expect(changed['--bg']).toBe('#070b16');
    expect(changed['--surface-2']).toBe(baseline['--surface-2']);
    for (const property of accentDerivedProperties) {
      expect(changed[property]).toBe(baseline[property]);
    }
  });

  it('rejects a borderline accent when black and white each fail a button endpoint', () => {
    const palette = {
      ...DEFAULT_THEME_PALETTES.light,
      background: '#ffffff',
      surface: '#ffffff',
      accent: '#767676',
    } satisfies ThemePalette;
    const validation = validateThemePalette('light', palette);
    const tokens = deriveThemeTokens('light', palette);
    const endpoints = [
      tokens['--primary-solid'],
      tokens['--primary-solid-gradient'],
      tokens['--primary-solid-hover'],
    ];

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          foreground: 'onPrimary',
          background: 'primaryGradient',
          minimum: 4.5,
        }),
      ]),
    );
    expect(
      validation.issues.some((issue) => issue.foreground === 'accent'),
    ).toBe(false);
    for (const candidate of ['#000000', '#ffffff']) {
      expect(
        endpoints.some((endpoint) => contrastRatio(candidate, endpoint) < 4.5),
      ).toBe(true);
    }
  });

  it('gives every accepted custom accent one readable button foreground', () => {
    const cases = [
      ['light', customLightPalette],
      ['dark', customDarkPalette],
    ] as const;

    for (const [mode, palette] of cases) {
      const validation = validateThemePalette(mode, palette);
      const tokens = deriveThemeTokens(mode, palette);
      expect(validation.valid).toBe(true);
      expect(['#000000', '#ffffff']).toContain(tokens['--on-primary']);
      for (const endpoint of [
        tokens['--primary-solid'],
        tokens['--primary-solid-gradient'],
        tokens['--primary-solid-hover'],
      ]) {
        expect(contrastRatio(tokens['--on-primary'], endpoint)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });

  it('rejects injected palettes before deriving any CSS values', () => {
    expect(() =>
      deriveThemeTokens('dark', {
        ...customDarkPalette,
        background: '#101722;background:red',
      }),
    ).toThrow(TypeError);
  });
});

describe('applying a theme to the document', () => {
  it('clears stale custom properties before applying the selected palette', () => {
    const root = document.documentElement;
    for (const property of THEME_CUSTOM_PROPERTIES) {
      root.style.setProperty(property, 'stale');
    }
    root.style.setProperty('--danger', '#c63838');

    applyThemeToDocument('dark', customDarkPalette);

    const expected = deriveThemeTokens('dark', customDarkPalette);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    for (const property of THEME_CUSTOM_PROPERTIES) {
      expect(root.style.getPropertyValue(property)).toBe(expected[property]);
    }
    expect(root.style.getPropertyValue('--danger')).toBe('#c63838');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      customDarkPalette.background,
    );
  });

  it('removes all inline token overrides when no custom palette is supplied', () => {
    applyThemeToDocument('dark', customDarkPalette);
    applyThemeToDocument('light');

    for (const property of THEME_CUSTOM_PROPERTIES) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe('');
    }
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      DEFAULT_THEME_PALETTES.light.background,
    );
  });

  it('falls back safely when a well-formed but inaccessible palette is passed', () => {
    const lowContrast = {
      background: '#ffffff',
      surface: '#ffffff',
      text: '#eeeeee',
      muted: '#dddddd',
      accent: '#cccccc',
      border: '#bbbbbb',
    } satisfies ThemePalette;
    document.documentElement.style.setProperty('--bg', 'stale');

    applyThemeToDocument('light', lowContrast);

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      DEFAULT_THEME_PALETTES.light.background,
    );
  });
});

describe('pre-paint initialization script', () => {
  it('applies a stored palette with the same tokens as the runtime path', () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');
    window.localStorage.setItem(
      THEME_COLORS_STORAGE_KEY,
      serializeStoredThemeColors({
        light: {
          ...customLightPalette,
          accent: '#ffffff',
        },
        dark: customDarkPalette,
      }),
    );

    runInitializationScript();

    const expected = deriveThemeTokens('dark', customDarkPalette);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    for (const property of THEME_CUSTOM_PROPERTIES) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe(
        expected[property],
      );
    }
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      customDarkPalette.background,
    );
  });

  it('uses the system mode and leaves baseline CSS unshadowed without custom colors', () => {
    mockSystemTheme(true);
    document.documentElement.style.setProperty('--primary', 'stale');

    runInitializationScript();

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    for (const property of THEME_CUSTOM_PROPERTIES) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe('');
    }
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      DEFAULT_THEME_PALETTES.dark.background,
    );
  });

  it('rejects stored low-contrast and injected values before paint', () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
    window.localStorage.setItem(
      THEME_COLORS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        palettes: {
          light: {
            background: '#ffffff',
            surface: '#ffffff',
            text: '#eeeeee',
            muted: '#dddddd',
            accent: '#cccccc;--danger:#000000',
            border: '#bbbbbb',
          },
        },
      }),
    );

    runInitializationScript();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--danger')).toBe('');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      DEFAULT_THEME_PALETTES.light.background,
    );
  });

  it('rejects a page-readable palette with no common button foreground before paint', () => {
    mockSystemTheme(false);
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
    window.localStorage.setItem(
      THEME_COLORS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        palettes: {
          light: {
            ...DEFAULT_THEME_PALETTES.light,
            background: '#ffffff',
            surface: '#ffffff',
            accent: '#767676',
          },
        },
      }),
    );

    runInitializationScript();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      DEFAULT_THEME_PALETTES.light.background,
    );
  });
});
