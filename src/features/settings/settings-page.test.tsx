import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/pages/settings';

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: {
      readingPreferences: { questionFontSize: 18, optionFontSize: 18 },
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock('@/pages/appearance', () => ({
  AppearanceSettings: () => <div aria-label="介面配色內容" />,
}));

afterEach(cleanup);

describe('SettingsPage', () => {
  it('combines reading and appearance settings into collapsible sections', () => {
    render(<SettingsPage />);

    expect(
      screen.queryByRole('heading', { name: '閱讀設定' }),
    ).not.toBeInTheDocument();
    const readingSection = screen
      .getByText('閱讀設定', { exact: true })
      .closest('details');
    const appearanceSection = screen
      .getByText('介面配色設定', { exact: true })
      .closest('details');
    expect(readingSection).toHaveAttribute('open');
    expect(appearanceSection).not.toHaveAttribute('open');
    expect(screen.getByLabelText('介面配色內容')).toBeInTheDocument();
  });
});
