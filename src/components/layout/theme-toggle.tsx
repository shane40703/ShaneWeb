import { IconMoonStars, IconSun } from '@tabler/icons-react';
import { useTheme } from '@/components/theme-provider';
import styles from './app-shell.module.css';

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const isDark = mode === 'dark';
  const targetLabel = isDark ? '淺色模式' : '深色模式';

  function toggleTheme() {
    setMode(isDark ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      aria-label={`切換為${targetLabel}`}
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
