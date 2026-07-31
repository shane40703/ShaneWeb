export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

export interface StoredThemeColors {
  version: 1;
  palettes: Partial<Record<ThemeMode, ThemePalette>>;
}

export const THEME_MODE_STORAGE_KEY = 'shane-web-theme';
export const THEME_COLORS_STORAGE_KEY = 'shaneweb:theme-colors';

export const THEME_PALETTE_FIELDS = [
  'background',
  'surface',
  'text',
  'muted',
  'accent',
  'border',
] as const;

export type ThemePaletteField = (typeof THEME_PALETTE_FIELDS)[number];

export const DEFAULT_THEME_PALETTES: Record<ThemeMode, ThemePalette> = {
  light: {
    background: '#f3f7fc',
    surface: '#ffffff',
    text: '#14213d',
    muted: '#6c7890',
    accent: '#2563eb',
    border: '#dde6f1',
  },
  dark: {
    background: '#0b1120',
    surface: '#111a2e',
    text: '#e8eef8',
    muted: '#93a4bb',
    accent: '#6ea8fe',
    border: '#263650',
  },
};

export const THEME_CUSTOM_PROPERTIES = [
  '--bg',
  '--surface',
  '--surface-elevated',
  '--surface-2',
  '--surface-3',
  '--text',
  '--text-soft',
  '--muted',
  '--line',
  '--line-strong',
  '--control-line',
  '--primary',
  '--primary-strong',
  '--primary-bright',
  '--primary-soft',
  '--primary-solid',
  '--primary-solid-hover',
  '--primary-solid-gradient',
  '--on-primary',
  '--focus',
  '--sidebar-surface',
  '--sidebar-text',
  '--sidebar-muted',
  '--sidebar-hover',
  '--sidebar-active',
  '--chart-1',
  '--subject-blue',
] as const;

export type ThemeCssVariable = (typeof THEME_CUSTOM_PROPERTIES)[number];
export type ThemeTokens = Record<ThemeCssVariable, string>;

export type ThemeContrastForeground = 'text' | 'muted' | 'accent' | 'onPrimary';
export type ThemeContrastBackground =
  | 'background'
  | 'surface'
  | 'surface2'
  | 'primarySolid'
  | 'primaryGradient'
  | 'primaryHover';

export interface ThemeContrastIssue {
  foreground: ThemeContrastForeground;
  background: ThemeContrastBackground;
  ratio: number;
  minimum: number;
}

export interface ThemePaletteValidation {
  valid: boolean;
  invalidFields: ThemePaletteField[];
  issues: ThemeContrastIssue[];
}

type PaletteCollection = Partial<Record<ThemeMode, ThemePalette>>;

/*
 * Keep color math in one self-contained factory. The same function is embedded
 * in THEME_INITIALIZATION_SCRIPT, so colors calculated before React starts are
 * byte-for-byte identical to colors calculated at runtime.
 */
function createThemeKernel() {
  const paletteFields = [
    'background',
    'surface',
    'text',
    'muted',
    'accent',
    'border',
  ] as const;
  const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isHexColor(value: unknown): value is string {
    return typeof value === 'string' && hexColorPattern.test(value);
  }

  function isThemePalette(value: unknown): value is ThemePalette {
    if (!isObject(value)) return false;
    const keys = Object.keys(value);
    return (
      keys.length === paletteFields.length &&
      paletteFields.every(
        (field) => Object.prototype.hasOwnProperty.call(value, field) && isHexColor(value[field]),
      )
    );
  }

  function rgb(color: string): [number, number, number] {
    if (!isHexColor(color)) {
      throw new TypeError(`Expected a full hexadecimal color, received ${String(color)}`);
    }
    return [
      Number.parseInt(color.slice(1, 3), 16),
      Number.parseInt(color.slice(3, 5), 16),
      Number.parseInt(color.slice(5, 7), 16),
    ];
  }

  function toHex(red: number, green: number, blue: number): string {
    const channel = (value: number) =>
      Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
    return `#${channel(red)}${channel(green)}${channel(blue)}`;
  }

  function mix(first: string, second: string, secondWeight: number): string {
    const firstRgb = rgb(first);
    const secondRgb = rgb(second);
    const weight = Math.max(0, Math.min(1, secondWeight));
    return toHex(
      firstRgb[0] * (1 - weight) + secondRgb[0] * weight,
      firstRgb[1] * (1 - weight) + secondRgb[1] * weight,
      firstRgb[2] * (1 - weight) + secondRgb[2] * weight,
    );
  }

  function relativeLuminance(color: string): number {
    const channels = rgb(color).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function contrastRatio(first: string, second: string): number {
    const firstLuminance = relativeLuminance(first);
    const secondLuminance = relativeLuminance(second);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function colorsEqual(first: string, second: string): boolean {
    return first.toLowerCase() === second.toLowerCase();
  }

  function selectOnPrimary(
    primarySolid: string,
    primaryGradient: string,
    primaryHover: string,
  ): { color: '#000000' | '#ffffff'; valid: boolean } {
    const endpoints = [primarySolid, primaryGradient, primaryHover];
    const candidates = ['#ffffff', '#000000'] as const;
    let bestColor: '#000000' | '#ffffff' = '#ffffff';
    let bestMinimumRatio = -1;

    for (const color of candidates) {
      const minimumRatio = Math.min(
        ...endpoints.map((endpoint) => contrastRatio(color, endpoint)),
      );
      if (minimumRatio >= 4.5) return { color, valid: true };
      if (minimumRatio > bestMinimumRatio) {
        bestColor = color;
        bestMinimumRatio = minimumRatio;
      }
    }

    return { color: bestColor, valid: false };
  }

  function deriveThemeTokens(
    mode: ThemeMode,
    palette: ThemePalette,
    defaultPalette: ThemePalette,
    defaultTokens: ThemeTokens,
  ): ThemeTokens {
    if (!isThemePalette(palette)) {
      throw new TypeError('Theme palettes must contain exactly six full hexadecimal colors.');
    }

    const dark = mode === 'dark';
    const backgroundChanged = !colorsEqual(palette.background, defaultPalette.background);
    const surfaceChanged = !colorsEqual(palette.surface, defaultPalette.surface);
    const textChanged = !colorsEqual(palette.text, defaultPalette.text);
    const mutedChanged = !colorsEqual(palette.muted, defaultPalette.muted);
    const accentChanged = !colorsEqual(palette.accent, defaultPalette.accent);
    const borderChanged = !colorsEqual(palette.border, defaultPalette.border);
    const tokens: ThemeTokens = {
      ...defaultTokens,
      '--bg': palette.background,
      '--surface': palette.surface,
      '--text': palette.text,
      '--muted': palette.muted,
      '--line': palette.border,
      '--control-line': palette.border,
      '--primary': palette.accent,
    };

    if (surfaceChanged) {
      tokens['--surface-elevated'] = dark
        ? mix(palette.surface, '#ffffff', 0.035)
        : palette.surface;
    }
    if ((dark && surfaceChanged) || (!dark && (backgroundChanged || surfaceChanged))) {
      tokens['--surface-2'] = dark
        ? mix(palette.surface, '#ffffff', 0.055)
        : mix(palette.background, palette.surface, 0.58);
    }
    if ((dark && surfaceChanged) || (!dark && (backgroundChanged || borderChanged))) {
      tokens['--surface-3'] = dark
        ? mix(palette.surface, '#ffffff', 0.12)
        : mix(palette.background, palette.border, 0.56);
    }
    if (textChanged || mutedChanged) {
      tokens['--text-soft'] = mix(palette.text, palette.muted, 0.36);
    }
    if (borderChanged || textChanged) {
      tokens['--line-strong'] = mix(
        palette.border,
        palette.text,
        dark ? 0.28 : 0.34,
      );
    }
    if (surfaceChanged || accentChanged) {
      tokens['--primary-soft'] = mix(
        palette.surface,
        palette.accent,
        dark ? 0.18 : 0.09,
      );
    }
    if (accentChanged) {
      const primarySolid = palette.accent;
      const primaryGradient = mix(palette.accent, '#ffffff', 0.04);
      const primaryHover = mix(palette.accent, '#000000', 0.12);
      const onPrimary = selectOnPrimary(
        primarySolid,
        primaryGradient,
        primaryHover,
      ).color;
      const accentRgb = rgb(palette.accent);

      tokens['--primary-strong'] = mix(
        palette.accent,
        dark ? '#ffffff' : '#000000',
        dark ? 0.18 : 0.16,
      );
      tokens['--primary-bright'] = mix(
        palette.accent,
        '#ffffff',
        dark ? 0.12 : 0.18,
      );
      tokens['--primary-solid'] = primarySolid;
      tokens['--primary-solid-gradient'] = primaryGradient;
      tokens['--primary-solid-hover'] = primaryHover;
      tokens['--on-primary'] = onPrimary;
      tokens['--focus'] = `rgb(${accentRgb[0]} ${accentRgb[1]} ${accentRgb[2]} / ${dark ? 42 : 28}%)`;
      tokens['--chart-1'] = palette.accent;
      tokens['--subject-blue'] = palette.accent;
    }

    let sidebarSurface = tokens['--sidebar-surface'];
    if (backgroundChanged || surfaceChanged) {
      sidebarSurface = mix(
        palette.background,
        palette.surface,
        dark ? 0.24 : 0.42,
      );
      tokens['--sidebar-surface'] = sidebarSurface;
    }
    if (textChanged) tokens['--sidebar-text'] = palette.text;
    if (mutedChanged) tokens['--sidebar-muted'] = palette.muted;
    if (backgroundChanged || surfaceChanged || textChanged) {
      tokens['--sidebar-hover'] = mix(
        sidebarSurface,
        palette.text,
        dark ? 0.07 : 0.04,
      );
    }
    if (backgroundChanged || surfaceChanged || accentChanged) {
      tokens['--sidebar-active'] = mix(
        sidebarSurface,
        palette.accent,
        dark ? 0.16 : 0.08,
      );
    }

    return tokens;
  }

  function validateThemePalette(
    mode: ThemeMode,
    value: unknown,
    defaultPalette: ThemePalette,
    defaultTokens: ThemeTokens,
  ): ThemePaletteValidation {
    const candidate = isObject(value) ? value : {};
    const invalidFields = paletteFields.filter(
      (field) => !isHexColor(candidate[field]),
    );
    if (invalidFields.length > 0 || !isThemePalette(value)) {
      return { valid: false, invalidFields: [...invalidFields], issues: [] };
    }

    const surface2 = deriveThemeTokens(
      mode,
      value,
      defaultPalette,
      defaultTokens,
    )['--surface-2'];
    const backgrounds: Array<[ThemeContrastBackground, string]> = [
      ['background', value.background],
      ['surface', value.surface],
      ['surface2', surface2],
    ];
    const foregrounds: Array<[ThemeContrastForeground, string, number]> = [
      ['text', value.text, 4.5],
      ['accent', value.accent, 4.5],
      ['muted', value.muted, 3],
    ];
    const issues: ThemeContrastIssue[] = [];

    for (const [foreground, foregroundColor, minimum] of foregrounds) {
      for (const [background, backgroundColor] of backgrounds) {
        const ratio = contrastRatio(foregroundColor, backgroundColor);
        if (ratio < minimum) {
          issues.push({ foreground, background, ratio, minimum });
        }
      }
    }

    if (!colorsEqual(value.accent, defaultPalette.accent)) {
      const tokens = deriveThemeTokens(mode, value, defaultPalette, defaultTokens);
      const buttonBackgrounds: Array<[ThemeContrastBackground, string]> = [
        ['primarySolid', tokens['--primary-solid']],
        ['primaryGradient', tokens['--primary-solid-gradient']],
        ['primaryHover', tokens['--primary-solid-hover']],
      ];
      for (const [background, backgroundColor] of buttonBackgrounds) {
        const ratio = contrastRatio(tokens['--on-primary'], backgroundColor);
        if (ratio < 4.5) {
          issues.push({
            foreground: 'onPrimary',
            background,
            ratio,
            minimum: 4.5,
          });
        }
      }
    }

    return { valid: issues.length === 0, invalidFields: [], issues };
  }

  return {
    contrastRatio,
    deriveThemeTokens,
    isHexColor,
    isThemePalette,
    validateThemePalette,
  };
}

const themeKernel = createThemeKernel();

const DEFAULT_THEME_TOKENS: Record<ThemeMode, ThemeTokens> = {
  light: {
    '--bg': '#f3f7fc',
    '--surface': '#ffffff',
    '--surface-elevated': '#ffffff',
    '--surface-2': '#f8fbff',
    '--surface-3': '#e9f0f8',
    '--text': '#14213d',
    '--text-soft': '#34425b',
    '--muted': '#6c7890',
    '--line': '#dde6f1',
    '--line-strong': '#a9bbd2',
    '--control-line': '#dde6f1',
    '--primary': '#2563eb',
    '--primary-strong': '#1d4ed8',
    '--primary-bright': '#4d8cff',
    '--primary-soft': '#edf4ff',
    '--primary-solid': '#2563eb',
    '--primary-solid-hover': '#1d4ed8',
    '--primary-solid-gradient': '#4d8cff',
    '--on-primary': '#ffffff',
    '--focus': 'rgb(37 99 235 / 28%)',
    '--sidebar-surface': '#fafafa',
    '--sidebar-text': 'rgb(0 0 0 / 88%)',
    '--sidebar-muted': 'rgb(0 0 0 / 50%)',
    '--sidebar-hover': 'rgb(31 31 31 / 4%)',
    '--sidebar-active': 'rgb(31 31 31 / 7%)',
    '--chart-1': '#2563eb',
    '--subject-blue': '#2563eb',
  },
  dark: {
    '--bg': '#0b1120',
    '--surface': '#111a2e',
    '--surface-elevated': '#172238',
    '--surface-2': '#172238',
    '--surface-3': '#22314b',
    '--text': '#e8eef8',
    '--text-soft': '#c0ccdc',
    '--muted': '#93a4bb',
    '--line': '#263650',
    '--line-strong': '#465b79',
    '--control-line': '#263650',
    '--primary': '#6ea8fe',
    '--primary-strong': '#91bdff',
    '--primary-bright': '#3b82f6',
    '--primary-soft': '#14294a',
    '--primary-solid': '#3b6fd8',
    '--primary-solid-hover': '#315fbd',
    '--primary-solid-gradient': '#315fbd',
    '--on-primary': '#ffffff',
    '--focus': 'rgb(110 168 254 / 42%)',
    '--sidebar-surface': '#0f1728',
    '--sidebar-text': 'rgb(238 244 255 / 92%)',
    '--sidebar-muted': 'rgb(204 216 235 / 60%)',
    '--sidebar-hover': 'rgb(255 255 255 / 6%)',
    '--sidebar-active': 'rgb(110 168 254 / 14%)',
    '--chart-1': '#6ea8fe',
    '--subject-blue': '#7db1ff',
  },
};

function emptyStoredThemeColors(): StoredThemeColors {
  return { version: 1, palettes: {} };
}

function copyPalette(palette: ThemePalette): ThemePalette {
  return {
    background: palette.background,
    surface: palette.surface,
    text: palette.text,
    muted: palette.muted,
    accent: palette.accent,
    border: palette.border,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isHexColor(value: unknown): value is string {
  return themeKernel.isHexColor(value);
}

export function isThemePalette(value: unknown): value is ThemePalette {
  return themeKernel.isThemePalette(value);
}

export function parseStoredThemeColors(raw: string | null): StoredThemeColors {
  if (raw === null) return emptyStoredThemeColors();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyStoredThemeColors();
  }

  if (!isObject(parsed) || parsed.version !== 1 || !isObject(parsed.palettes)) {
    return emptyStoredThemeColors();
  }

  const palettes: PaletteCollection = {};
  for (const mode of ['light', 'dark'] as const) {
    const candidate = parsed.palettes[mode];
    if (
      isThemePalette(candidate) &&
      validateThemePalette(mode, candidate).valid
    ) {
      palettes[mode] = copyPalette(candidate);
    }
  }
  return { version: 1, palettes };
}

export function serializeStoredThemeColors(
  value: PaletteCollection | StoredThemeColors,
): string {
  const source = 'palettes' in value ? value.palettes : value;
  const palettes: PaletteCollection = {};
  for (const mode of ['light', 'dark'] as const) {
    const candidate = source[mode];
    if (isThemePalette(candidate)) palettes[mode] = copyPalette(candidate);
  }
  return JSON.stringify({ version: 1, palettes } satisfies StoredThemeColors);
}

/** @deprecated Prefer serializeStoredThemeColors for the explicit storage schema. */
export const serializeThemeColors = serializeStoredThemeColors;

export function readStoredThemeColors(
  storage?: Pick<Storage, 'getItem'>,
): StoredThemeColors {
  try {
    const source = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage);
    return source
      ? parseStoredThemeColors(source.getItem(THEME_COLORS_STORAGE_KEY))
      : emptyStoredThemeColors();
  } catch {
    return emptyStoredThemeColors();
  }
}

export function themePaletteForMode(
  value: PaletteCollection | StoredThemeColors | null | undefined,
  mode: ThemeMode,
): ThemePalette {
  let palettes: PaletteCollection | undefined;
  if (value && 'palettes' in value) {
    palettes = value.version === 1 ? value.palettes : undefined;
  } else {
    palettes = value ?? undefined;
  }
  const palette = palettes?.[mode];
  return copyPalette(isThemePalette(palette) ? palette : DEFAULT_THEME_PALETTES[mode]);
}

export function contrastRatio(first: string, second: string): number {
  return themeKernel.contrastRatio(first, second);
}

export function deriveThemeTokens(mode: ThemeMode, palette: ThemePalette): ThemeTokens {
  const safeMode: ThemeMode = mode === 'dark' ? 'dark' : 'light';
  return themeKernel.deriveThemeTokens(
    safeMode,
    palette,
    DEFAULT_THEME_PALETTES[safeMode],
    DEFAULT_THEME_TOKENS[safeMode],
  );
}

export function validateThemePalette(
  mode: ThemeMode,
  palette: ThemePalette,
): ThemePaletteValidation {
  const safeMode: ThemeMode = mode === 'dark' ? 'dark' : 'light';
  return themeKernel.validateThemePalette(
    safeMode,
    palette,
    DEFAULT_THEME_PALETTES[safeMode],
    DEFAULT_THEME_TOKENS[safeMode],
  );
}

export function getAppliedTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyThemeToDocument(
  mode: ThemeMode,
  customPalette?: ThemePalette,
): void {
  if (typeof document === 'undefined') return;

  const safeMode: ThemeMode = mode === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  for (const property of THEME_CUSTOM_PROPERTIES) root.style.removeProperty(property);

  root.dataset.theme = safeMode;
  root.style.colorScheme = safeMode;

  const palette = isThemePalette(customPalette) && validateThemePalette(safeMode, customPalette).valid
    ? customPalette
    : undefined;
  if (palette) {
    const tokens = deriveThemeTokens(safeMode, palette);
    for (const property of THEME_CUSTOM_PROPERTIES) {
      root.style.setProperty(property, tokens[property]);
    }
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', (palette ?? DEFAULT_THEME_PALETTES[safeMode]).background);
}

function initializeThemeBeforePaint(
  kernelFactory: typeof createThemeKernel,
  modeStorageKey: string,
  colorsStorageKey: string,
  defaultPalettes: Record<ThemeMode, ThemePalette>,
  defaultTokens: Record<ThemeMode, ThemeTokens>,
  customProperties: readonly ThemeCssVariable[],
): void {
  const kernel = kernelFactory();
  const root = document.documentElement;
  let mode: ThemeMode = 'light';

  try {
    const savedMode = window.localStorage.getItem(modeStorageKey);
    const prefersDark = Boolean(
      window.matchMedia?.('(prefers-color-scheme: dark)').matches,
    );
    mode = savedMode === 'light' || savedMode === 'dark'
      ? savedMode
      : prefersDark
        ? 'dark'
        : 'light';
  } catch {
    try {
      mode = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      mode = 'light';
    }
  }

  for (const property of customProperties) root.style.removeProperty(property);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;

  let customPalette: ThemePalette | undefined;
  try {
    const raw = window.localStorage.getItem(colorsStorageKey);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        (parsed as { version?: unknown }).version === 1
      ) {
        const palettes = (parsed as { palettes?: unknown }).palettes;
        if (typeof palettes === 'object' && palettes !== null && !Array.isArray(palettes)) {
          const candidate = (palettes as Record<string, unknown>)[mode];
          if (
            kernel.isThemePalette(candidate) &&
            kernel.validateThemePalette(
              mode,
              candidate,
              defaultPalettes[mode],
              defaultTokens[mode],
            ).valid
          ) {
            customPalette = candidate;
          }
        }
      }
    }
  } catch {
    // A malformed or unavailable store falls back to the built-in palette.
  }

  if (customPalette) {
    const tokens = kernel.deriveThemeTokens(
      mode,
      customPalette,
      defaultPalettes[mode],
      defaultTokens[mode],
    );
    for (const property of customProperties) {
      root.style.setProperty(property, tokens[property]);
    }
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      (customPalette ?? defaultPalettes[mode]).background,
    );
}

export const THEME_INITIALIZATION_SCRIPT = `(${initializeThemeBeforePaint.toString()})(` +
  `${createThemeKernel.toString()},` +
  `${JSON.stringify(THEME_MODE_STORAGE_KEY)},` +
  `${JSON.stringify(THEME_COLORS_STORAGE_KEY)},` +
  `${JSON.stringify(DEFAULT_THEME_PALETTES)},` +
  `${JSON.stringify(DEFAULT_THEME_TOKENS)},` +
  `${JSON.stringify(THEME_CUSTOM_PROPERTIES)}` +
  `);`;
