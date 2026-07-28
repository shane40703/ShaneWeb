import { useSyncExternalStore } from 'react';
import { IconMoonStars, IconSun } from '@tabler/icons-react';
import styles from './app-shell.module.css';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'shane-web-theme';
const themeListeners = new Set<() => void>();

function appliedTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f3f7fc');
  themeListeners.forEach((listener) => listener());
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(
    subscribeToTheme,
    appliedTheme,
    () => null,
  );

  const isDark = theme === 'dark';
  const targetLabel = isDark ? '淺色模式' : '深色模式';

  function toggleTheme() {
    const nextTheme: Theme = appliedTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still applies for this visit if browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      aria-label={`切換為${targetLabel}`}
      aria-pressed={isDark}
      title={`切換為${targetLabel}`}
    >
      {isDark ? (
        <IconSun size={18} stroke={2} aria-hidden="true" />
      ) : (
        <IconMoonStars size={18} stroke={2} aria-hidden="true" />
      )}
      <span>{targetLabel}</span>
    </button>
  );
}
