import {
  DEFAULT_THEME_PALETTES,
  THEME_PALETTE_FIELDS,
  type ThemeMode,
  type ThemePalette,
} from './theme';

export interface OfficialThemePreset {
  id: string;
  name: string;
  description: string;
  palette: ThemePalette;
}

/*
 * These restrained six-color palettes follow the same semantic layering used
 * by mature editor and product theme systems: canvas, raised surface, content,
 * supporting content, a single action accent, and separators. The names and
 * final values are original to ShaneWeb rather than copies of third-party
 * themes.
 */
export const OFFICIAL_THEME_PRESETS: Record<
  ThemeMode,
  readonly OfficialThemePreset[]
> = {
  light: [
    {
      id: 'blueprint-dawn',
      name: '藍圖晨光',
      description: '清爽冷藍，適合長時間閱讀與日常作答。',
      palette: { ...DEFAULT_THEME_PALETTES.light },
    },
    {
      id: 'modern-paper',
      name: '現代紙白',
      description: '俐落中性色階，讓內容與操作層次更明確。',
      palette: {
        background: '#F5F5F5',
        surface: '#FFFFFF',
        text: '#1F1F1F',
        muted: '#616161',
        accent: '#005FB8',
        border: '#D8D8D8',
      },
    },
    {
      id: 'warm-parchment',
      name: '暖砂紙',
      description: '低刺激的暖白與琥珀，像紙本般柔和。',
      palette: {
        background: '#F7F1E8',
        surface: '#FFFCF7',
        text: '#2A241D',
        muted: '#6C6257',
        accent: '#95520B',
        border: '#DED2C1',
      },
    },
    {
      id: 'sage-mist',
      name: '松霧綠',
      description: '沉靜鼠尾草綠，降低長時間專注的視覺壓力。',
      palette: {
        background: '#EFF6F2',
        surface: '#FBFEFC',
        text: '#183129',
        muted: '#5C6F67',
        accent: '#176B52',
        border: '#CFDFD7',
      },
    },
    {
      id: 'iris-daylight',
      name: '鳶尾晨紫',
      description: '柔霧紫灰搭配深紫重點，安定而有辨識度。',
      palette: {
        background: '#F5F2FA',
        surface: '#FDFBFF',
        text: '#2B2237',
        muted: '#6D6378',
        accent: '#6D45A1',
        border: '#DDD5E7',
      },
    },
  ],
  dark: [
    {
      id: 'blueprint-midnight',
      name: '藍圖深夜',
      description: '深藍分層搭配明亮焦點，適合低光環境。',
      palette: { ...DEFAULT_THEME_PALETTES.dark },
    },
    {
      id: 'modern-carbon',
      name: '現代炭黑',
      description: '中性炭黑與清晰藍色，專注、俐落、少干擾。',
      palette: {
        background: '#181818',
        surface: '#1F1F1F',
        text: '#E6E6E6',
        muted: '#A6A6A6',
        accent: '#4DAAFC',
        border: '#3C3C3C',
      },
    },
    {
      id: 'deep-tide',
      name: '深潮墨綠',
      description: '冷調深海底色與薄荷重點，沉浸但不沉重。',
      palette: {
        background: '#07191C',
        surface: '#0D2528',
        text: '#E6F4F2',
        muted: '#9ABDB8',
        accent: '#5EEAD4',
        border: '#28474A',
      },
    },
    {
      id: 'violet-night',
      name: '夜幕鳶紫',
      description: '深紫黑搭配柔亮鳶尾色，低調又有個性。',
      palette: {
        background: '#17131F',
        surface: '#211A2C',
        text: '#F1EBF7',
        muted: '#B8ABC5',
        accent: '#D0A5FF',
        border: '#453754',
      },
    },
    {
      id: 'amber-evening',
      name: '琥珀暮夜',
      description: '暖黑與琥珀光感，帶來接近紙燈的舒適氛圍。',
      palette: {
        background: '#1D1814',
        surface: '#29211B',
        text: '#F4EDE6',
        muted: '#BAAA9C',
        accent: '#F0B35F',
        border: '#4A3A2E',
      },
    },
  ],
};

export function themePalettesMatch(
  left: ThemePalette,
  right: ThemePalette,
): boolean {
  return THEME_PALETTE_FIELDS.every(
    (field) => left[field].toLowerCase() === right[field].toLowerCase(),
  );
}

export function findOfficialThemePreset(
  mode: ThemeMode,
  palette: ThemePalette,
): OfficialThemePreset | undefined {
  return OFFICIAL_THEME_PRESETS[mode].find((preset) =>
    themePalettesMatch(preset.palette, palette),
  );
}
