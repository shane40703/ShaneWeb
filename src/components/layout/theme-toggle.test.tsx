import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import {
  serializeStoredThemeColors,
  THEME_COLORS_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  type ThemePalette,
} from '@/lib/theme';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { ThemeToggle } from './theme-toggle';

const batchedLightPalette: ThemePalette = {
  background: '#FFFFFF',
  surface: '#F7F7F7',
  text: '#000000',
  muted: '#555555',
  accent: '#0000CC',
  border: '#CCCCCC',
};

const batchedDarkPalette: ThemePalette = {
  background: '#000000',
  surface: '#121212',
  text: '#FFFFFF',
  muted: '#BBBBBB',
  accent: '#00FFFF',
  border: '#444444',
};

function PersistenceProbe() {
  const { persistence } = useAppState();
  return <output aria-label="儲存狀態">{persistence}</output>;
}

function BatchedThemeActions() {
  const { customPalettes, savePalette, setMode } = useTheme();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          savePalette('light', batchedLightPalette);
          savePalette('dark', batchedDarkPalette);
          setMode('dark');
        }}
      >
        批次儲存並切換
      </button>
      <output aria-label="自訂模式">
        {Object.keys(customPalettes).sort().join(',')}
      </output>
    </>
  );
}

function renderToggle() {
  return render(
    <AppStateProvider>
      <ThemeProvider>
        <ThemeToggle />
        <PersistenceProbe />
      </ThemeProvider>
    </AppStateProvider>,
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'light';
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('switches themes and remembers the selected theme', async () => {
    const user = userEvent.setup();

    renderToggle();

    await user.click(
      await screen.findByRole('button', { name: '切換為深色模式' }),
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('shane-web-theme')).toBe('dark');
    expect(
      screen.getByRole('button', { name: '切換為淺色模式' }),
    ).not.toHaveAttribute('aria-pressed');

    await user.click(screen.getByRole('button', { name: '切換為淺色模式' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('shane-web-theme')).toBe('light');
  });

  it('applies the saved custom palette whenever its mode becomes active', async () => {
    window.localStorage.setItem(
      THEME_COLORS_STORAGE_KEY,
      serializeStoredThemeColors({ dark: batchedDarkPalette }),
    );
    const user = userEvent.setup();

    renderToggle();
    await user.click(
      await screen.findByRole('button', { name: '切換為深色模式' }),
    );

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      '#000000',
    );
    expect(document.documentElement.style.getPropertyValue('--surface')).toBe(
      '#121212',
    );

    await user.click(screen.getByRole('button', { name: '切換為淺色模式' }));
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');

    await user.click(screen.getByRole('button', { name: '切換為深色模式' }));
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      '#000000',
    );
  });

  it('keeps the new mode for this visit and reports failed persistence', async () => {
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === THEME_MODE_STORAGE_KEY) {
        throw new DOMException('Storage is unavailable', 'SecurityError');
      }
      return originalSetItem.call(this, key, value);
    });
    const user = userEvent.setup();

    renderToggle();
    await user.click(
      await screen.findByRole('button', { name: '切換為深色模式' }),
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await waitFor(() =>
      expect(screen.getByLabelText('儲存狀態')).toHaveTextContent(
        'unavailable',
      ),
    );
  });

  it('keeps batched palette saves and switches with the latest palette', async () => {
    const user = userEvent.setup();

    render(
      <AppStateProvider>
        <ThemeProvider>
          <BatchedThemeActions />
        </ThemeProvider>
      </AppStateProvider>,
    );
    await user.click(
      screen.getByRole('button', { name: '批次儲存並切換' }),
    );

    expect(screen.getByLabelText('自訂模式')).toHaveTextContent('dark,light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(
      batchedDarkPalette.background,
    );
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
    expect(
      JSON.parse(
        window.localStorage.getItem(THEME_COLORS_STORAGE_KEY) ?? '{}',
      ).palettes,
    ).toEqual({
      light: batchedLightPalette,
      dark: batchedDarkPalette,
    });
  });
});
