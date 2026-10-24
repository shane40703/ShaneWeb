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
 * themes. The first palette of each mode is the site default: warm graph paper.
 */
export const OFFICIAL_THEME_PRESETS: Record<
  ThemeMode,
  readonly OfficialThemePreset[]
> = {
  light: [
    {
      id: 'paper-grid-light',
      name: '米紙方格',
      description: '米色方格紙底、奶油色面板與墨線，像在圖紙上作答。',
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
      id: 'blueprint-dawn',
      name: '藍圖晨光',
      description: '清爽冷藍，適合長時間閱讀與日常作答。',
      palette: {
        background: '#F3F7FC',
        surface: '#FFFFFF',
        text: '#14213D',
        muted: '#6C7890',
        accent: '#2563EB',
        border: '#DDE6F1',
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
      id: 'paper-grid-dark',
      name: '墨紙方格',
      description: '暖黑紙底與淡米色文字，方格線退到背景裡。',
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
      id: 'blueprint-midnight',
      name: '藍圖深夜',
      description: '深藍分層搭配明亮焦點，適合低光環境。',
      palette: {
        background: '#0B1120',
        surface: '#111A2E',
        text: '#E8EEF8',
        muted: '#93A4BB',
        accent: '#6EA8FE',
        border: '#263650',
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
