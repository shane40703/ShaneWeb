import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import AppearancePage from '@/pages/appearance';
import {
  DEFAULT_THEME_PALETTES,
  type ThemeMode,
  type ThemePalette,
} from '@/lib/theme';
import { OFFICIAL_THEME_PRESETS } from '@/lib/theme-presets';

const useThemeMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/theme-provider', () => ({
  useTheme: useThemeMock,
}));

const customLightPalette: ThemePalette = {
  background: '#F7F3EA',
  surface: '#FFFFFF',
  text: '#211D17',
  muted: '#6A6257',
  accent: '#8B3A14',
  border: '#D9CCBA',
};

function copyPalette(palette: ThemePalette): ThemePalette {
  return { ...palette };
}

function themeContext({
  mode = 'light',
  light = DEFAULT_THEME_PALETTES.light,
  dark = DEFAULT_THEME_PALETTES.dark,
  customPalettes = {},
}: {
  mode?: ThemeMode;
  light?: ThemePalette;
  dark?: ThemePalette;
  customPalettes?: Partial<Record<ThemeMode, ThemePalette>>;
} = {}) {
  return {
    mode,
    palettes: {
      light: copyPalette(light),
      dark: copyPalette(dark),
    },
    customPalettes,
    hydrated: true,
    savePalette: vi.fn(
      (): 'saved' | 'quota-exceeded' | 'unavailable' | 'invalid' => 'saved',
    ),
    resetPalette: vi.fn(
      (): 'saved' | 'quota-exceeded' | 'unavailable' => 'saved',
    ),
  };
}

function renderPage(context = themeContext()) {
  useThemeMock.mockReturnValue(context);
  return {
    ...render(
      <ToastProvider>
        <AppearancePage />
      </ToastProvider>,
    ),
    context,
  };
}

describe('AppearancePage', () => {
  beforeEach(() => {
    useThemeMock.mockReset();
  });

  afterEach(cleanup);

  it('offers five official palettes for the mode being edited', async () => {
    const user = userEvent.setup();
    renderPage();

    const lightPresets = screen.getByRole('radiogroup', {
      name: '淺色模式本站官方配色',
    });
    expect(within(lightPresets).getAllByRole('radio')).toHaveLength(5);
    expect(
      within(lightPresets).getByRole('radio', { name: /現代紙白/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /現代炭黑/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '深色模式' }));

    const darkPresets = screen.getByRole('radiogroup', {
      name: '深色模式本站官方配色',
    });
    expect(within(darkPresets).getAllByRole('radio')).toHaveLength(5);
    expect(
      within(darkPresets).getByRole('radio', { name: /現代炭黑/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /現代紙白/ }),
    ).not.toBeInTheDocument();
  });

  it('previews an official palette before saving and applies its six colors', async () => {
    const user = userEvent.setup();
    const { context } = renderPage();
    const preset = OFFICIAL_THEME_PRESETS.light[1];

    await user.click(screen.getByRole('radio', { name: /現代紙白/ }));

    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      preset.palette.background,
    );
    expect(
      screen
        .getByRole('region', { name: '淺色模式配色預覽' })
        .style.getPropertyValue('--bg'),
    ).toBe(preset.palette.background);
    expect(context.savePalette).not.toHaveBeenCalled();
    expect(
      screen.getByText(/已選擇「現代紙白」.*按「套用此模式」後才會保存/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '套用此模式' }));

    expect(context.savePalette).toHaveBeenCalledWith('light', preset.palette);
    expect(await screen.findByText('已套用淺色模式配色')).toBeInTheDocument();
  });

  it('keeps saved and preview states distinct and leaves official presets when edited', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByRole('radio', { name: /藍圖晨光.*使用中/ }),
    ).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /現代紙白/ }));
    expect(
      screen.getByRole('radio', { name: /現代紙白.*預覽中/ }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /藍圖晨光.*使用中/ }),
    ).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('頁面背景十六進位色碼'), {
      target: { value: '#F4F4F4' },
    });

    expect(
      within(
        screen.getByRole('radiogroup', {
          name: '淺色模式本站官方配色',
        }),
      )
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('resets stored colors when the baseline official palette is applied', async () => {
    const user = userEvent.setup();
    const paper = OFFICIAL_THEME_PRESETS.light[1].palette;
    const context = themeContext({
      light: paper,
      customPalettes: { light: paper },
    });
    renderPage(context);

    await user.click(screen.getByRole('radio', { name: /藍圖晨光/ }));
    expect(context.resetPalette).not.toHaveBeenCalled();
    expect(context.savePalette).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '套用此模式' }));

    expect(context.resetPalette).toHaveBeenCalledWith('light');
    expect(context.savePalette).not.toHaveBeenCalled();
  });

  it('keeps appearance controls unavailable until stored colors hydrate', () => {
    const context = themeContext();
    context.hydrated = false;
    renderPage(context);

    expect(screen.getByRole('radio', { name: '深色模式' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /藍圖晨光/ })).toBeDisabled();
    expect(screen.getByLabelText('頁面背景十六進位色碼')).toBeDisabled();
    expect(screen.getByRole('button', { name: '載入預設色' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '套用此模式' })).toBeDisabled();
  });

  it('keeps independent drafts while switching between light and dark editing modes', async () => {
    const user = userEvent.setup();
    renderPage();

    const lightBackground = screen.getByLabelText('頁面背景十六進位色碼');
    await user.clear(lightBackground);
    await user.type(lightBackground, '#FFFDF5');

    await user.click(screen.getByRole('radio', { name: '深色模式' }));
    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      DEFAULT_THEME_PALETTES.dark.background,
    );
    fireEvent.change(screen.getByLabelText('頁面背景十六進位色碼'), {
      target: { value: '#090D12' },
    });

    await user.click(screen.getByRole('radio', { name: '淺色模式' }));
    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      '#FFFDF5',
    );

    await user.click(screen.getByRole('radio', { name: '深色模式' }));
    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      '#090D12',
    );
  });

  it('loads stored palettes once hydration completes without overwriting later drafts', () => {
    const initial = themeContext();
    initial.hydrated = false;
    useThemeMock.mockReturnValue(initial);
    const view = render(
      <ToastProvider>
        <AppearancePage />
      </ToastProvider>,
    );

    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      DEFAULT_THEME_PALETTES.light.background,
    );

    const hydrated = themeContext({
      light: customLightPalette,
      customPalettes: { light: customLightPalette },
    });
    useThemeMock.mockReturnValue(hydrated);
    view.rerender(
      <ToastProvider>
        <AppearancePage />
      </ToastProvider>,
    );
    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      customLightPalette.background,
    );

    fireEvent.change(screen.getByLabelText('頁面背景十六進位色碼'), {
      target: { value: '#FFFDF5' },
    });
    useThemeMock.mockReturnValue(themeContext());
    view.rerender(
      <ToastProvider>
        <AppearancePage />
      </ToastProvider>,
    );
    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      '#FFFDF5',
    );
  });

  it('synchronizes the native color control and hexadecimal input', () => {
    renderPage();

    const picker = screen.getByLabelText('選擇頁面背景顏色');
    const hex = screen.getByLabelText('頁面背景十六進位色碼');

    fireEvent.change(picker, { target: { value: '#aabbcc' } });
    expect(hex).toHaveValue('#AABBCC');

    fireEvent.change(hex, { target: { value: '#ABCDEF' } });
    expect(picker).toHaveValue('#abcdef');
  });

  it('blocks malformed hexadecimal values and keeps the last valid preview', () => {
    renderPage();
    const hex = screen.getByLabelText('頁面背景十六進位色碼');
    const preview = screen.getByRole('region', { name: '淺色模式配色預覽' });

    fireEvent.change(hex, { target: { value: '#FFFDF5' } });
    expect(preview.style.getPropertyValue('--bg')).toBe('#FFFDF5');

    fireEvent.change(hex, { target: { value: '#BAD' } });

    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(hex).toHaveAccessibleDescription(/請輸入完整色碼/);
    expect(preview.style.getPropertyValue('--bg')).toBe('#FFFDF5');
    expect(screen.getByRole('button', { name: '套用此模式' })).toBeDisabled();
    expect(
      screen.getByText('請先將所有色碼填成完整的 #RRGGBB 格式。'),
    ).toBeInTheDocument();
  });

  it('names failed contrast pairs and prevents applying them', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('主要文字十六進位色碼'), {
      target: { value: DEFAULT_THEME_PALETTES.light.background },
    });

    expect(
      screen.getByText(/主要文字與頁面背景對比為 1\.00:1/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '套用此模式' })).toBeDisabled();
  });

  it('applies the active mode and stores an inactive mode with contextual feedback', async () => {
    const user = userEvent.setup();
    const { context } = renderPage();

    await user.click(screen.getByRole('button', { name: '套用此模式' }));
    expect(context.savePalette).toHaveBeenCalledWith(
      'light',
      DEFAULT_THEME_PALETTES.light,
    );
    expect(await screen.findByText('已套用淺色模式配色')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '深色模式' }));
    await user.click(screen.getByRole('button', { name: '套用此模式' }));
    expect(context.savePalette).toHaveBeenLastCalledWith(
      'dark',
      DEFAULT_THEME_PALETTES.dark,
    );
    expect(await screen.findByText('已儲存深色模式配色')).toBeInTheDocument();
  });

  it('loads defaults into the draft without resetting storage until apply', async () => {
    const user = userEvent.setup();
    const context = themeContext({
      light: customLightPalette,
      customPalettes: { light: customLightPalette },
    });
    renderPage(context);

    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      customLightPalette.background,
    );
    await user.click(screen.getByRole('button', { name: '載入預設色' }));

    expect(screen.getByLabelText('頁面背景十六進位色碼')).toHaveValue(
      DEFAULT_THEME_PALETTES.light.background,
    );
    expect(context.resetPalette).not.toHaveBeenCalled();
    expect(context.savePalette).not.toHaveBeenCalled();
    expect(
      screen.getByText(/已載入淺色模式預設色.*按「套用此模式」後才會保存/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '套用此模式' }));

    expect(context.resetPalette).toHaveBeenCalledWith('light');
    expect(context.savePalette).not.toHaveBeenCalled();
  });

  it('explains that a storage failure only preserves the palette for this visit', async () => {
    const user = userEvent.setup();
    const context = themeContext();
    context.savePalette.mockReturnValue('unavailable');
    renderPage(context);

    await user.click(screen.getByRole('button', { name: '套用此模式' }));

    await waitFor(() => {
      expect(
        screen.getAllByText(/重新整理後會還原/).length,
      ).toBeGreaterThan(0);
    });
    expect(
      screen.queryByText('配色已更新，但無法保存'),
    ).not.toBeInTheDocument();
  });

  it('renders preview links and buttons as non-interactive examples', () => {
    renderPage();

    expect(screen.getByText('查看重點連結')).toBeInTheDocument();
    expect(screen.getByText('主要按鈕')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看重點連結' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '主要按鈕' }),
    ).not.toBeInTheDocument();
  });
});
