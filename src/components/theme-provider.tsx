import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  applyThemeToDocument,
  DEFAULT_THEME_PALETTES,
  getAppliedTheme,
  parseStoredThemeColors,
  serializeStoredThemeColors,
  THEME_COLORS_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  type ThemeMode,
  type ThemePalette,
  validateThemePalette,
} from '@/lib/theme';
import {
  readStoredValue,
  writeStoredValue,
  type StorageWriteResult,
} from '@/lib/storage';
import { useAppState } from '@/state/app-state';

type CustomThemePalettes = Partial<Record<ThemeMode, ThemePalette>>;

interface ThemeContextValue {
  mode: ThemeMode;
  hydrated: boolean;
  palettes: Record<ThemeMode, ThemePalette>;
  customPalettes: CustomThemePalettes;
  setMode: (mode: ThemeMode) => StorageWriteResult;
  savePalette: (
    mode: ThemeMode,
    palette: ThemePalette,
  ) => StorageWriteResult | 'invalid';
  resetPalette: (mode: ThemeMode) => StorageWriteResult;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { reportPersistence } = useAppState();
  const [mode, setCurrentMode] = useState<ThemeMode>('light');
  const [hydrated, setHydrated] = useState(false);
  const [customPalettes, setCustomPalettes] =
    useState<CustomThemePalettes>({});
  const modeRef = useRef<ThemeMode>('light');
  const customPalettesRef = useRef<CustomThemePalettes>({});

  useEffect(() => {
    const savedMode = readStoredValue(THEME_MODE_STORAGE_KEY);
    const initialMode = isThemeMode(savedMode) ? savedMode : getAppliedTheme();
    const storedColors = parseStoredThemeColors(
      readStoredValue(THEME_COLORS_STORAGE_KEY),
    );
    const loadedCustomPalettes: CustomThemePalettes = {};
    for (const themeMode of ['light', 'dark'] as const) {
      const palette = storedColors.palettes[themeMode];
      if (palette && validateThemePalette(themeMode, palette).valid) {
        loadedCustomPalettes[themeMode] = palette;
      }
    }

    // Storage is intentionally read after hydration so server and client render
    // the same controls; the pre-paint script already keeps the page colors stable.
    modeRef.current = initialMode;
    customPalettesRef.current = loadedCustomPalettes;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMode(initialMode);
    setCustomPalettes(loadedCustomPalettes);
    setHydrated(true);
    applyThemeToDocument(initialMode, loadedCustomPalettes[initialMode]);
  }, []);

  const palettes = useMemo(
    () => ({
      ...DEFAULT_THEME_PALETTES,
      ...customPalettes,
    }),
    [customPalettes],
  );

  const setMode = useCallback(
    (nextMode: ThemeMode) => {
      modeRef.current = nextMode;
      setCurrentMode(nextMode);
      applyThemeToDocument(nextMode, customPalettesRef.current[nextMode]);
      const result = writeStoredValue(THEME_MODE_STORAGE_KEY, nextMode);
      reportPersistence('theme-mode', result);
      return result;
    },
    [reportPersistence],
  );

  const savePalette = useCallback(
    (targetMode: ThemeMode, palette: ThemePalette) => {
      if (!validateThemePalette(targetMode, palette).valid) return 'invalid';

      const savedPalette = { ...palette };
      const nextCustomPalettes = {
        ...customPalettesRef.current,
        [targetMode]: savedPalette,
      };
      customPalettesRef.current = nextCustomPalettes;
      setCustomPalettes(nextCustomPalettes);
      if (targetMode === modeRef.current) {
        applyThemeToDocument(targetMode, savedPalette);
      }

      const result = writeStoredValue(
        THEME_COLORS_STORAGE_KEY,
        serializeStoredThemeColors(nextCustomPalettes),
      );
      reportPersistence('theme-colors', result);
      return result;
    },
    [reportPersistence],
  );

  const resetPalette = useCallback(
    (targetMode: ThemeMode) => {
      const nextCustomPalettes = { ...customPalettesRef.current };
      delete nextCustomPalettes[targetMode];
      customPalettesRef.current = nextCustomPalettes;
      setCustomPalettes(nextCustomPalettes);
      if (targetMode === modeRef.current) applyThemeToDocument(targetMode);

      const result = writeStoredValue(
        THEME_COLORS_STORAGE_KEY,
        serializeStoredThemeColors(nextCustomPalettes),
      );
      reportPersistence('theme-colors', result);
      return result;
    },
    [reportPersistence],
  );

  return (
    <ThemeContext.Provider
      value={{
        mode,
        hydrated,
        palettes,
        customPalettes,
        setMode,
        savePalette,
        resetPalette,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
