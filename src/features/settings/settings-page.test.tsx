import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '@/features/settings/settings-panel';
import SettingsPage from '@/pages/settings';

const dispatch = vi.hoisted(() => vi.fn());
vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: {
      readingPreferences: { questionFontSize: 18, optionFontSize: 18 },
    },
    dispatch,
  }),
}));

vi.mock('@/pages/appearance', () => ({
  AppearanceSettings: () => <div aria-label="介面配色內容" />,
}));

beforeEach(() => dispatch.mockReset());
afterEach(cleanup);

describe('SettingsPage', () => {
  it('provides both question and option size controls within the reading settings', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('閱讀設定', { exact: true }));
    const question = screen.getByRole('slider', { name: '題目字體' });
    const option = screen.getByRole('slider', { name: '選項字體' });
    expect(question).toHaveValue('18');
    expect(option).toHaveValue('18');
    fireEvent.change(question, { target: { value: '24' } });
    fireEvent.change(option, { target: { value: '14' } });
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'set-reading-font-size', target: 'question', size: 24 }],
      [{ type: 'set-reading-font-size', target: 'option', size: 14 }],
    ]);
  });

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
    expect(readingSection).not.toHaveAttribute('open');
    expect(appearanceSection).not.toHaveAttribute('open');
    expect(screen.getByLabelText('介面配色內容')).toBeInTheDocument();
  });

  it('links to 開源授權 as a row of its own instead of a collapsible section', () => {
    render(<SettingsPage />);

    const link = screen.getByRole('link', { name: /^開源授權/ });
    expect(link).toHaveAttribute('href', '/licenses');
    expect(link).toHaveTextContent('網站程式碼的授權，以及用到的字型、資料和第三方套件');
    expect(link.closest('details')).toBeNull();
    // The last section of the panel; the dashed rule belongs to the section, not the link.
    expect(link.closest('section')?.lastElementChild).toContainElement(link);
    expect(link.parentElement?.tagName).toBe('DIV');
  });

  it('tells the settings dialog to close when the row is followed, but not for a new tab', () => {
    const onNavigate = vi.fn();
    render(<SettingsPanel onNavigate={onNavigate} />);

    const link = screen.getByRole('link', { name: /^開源授權/ });
    // jsdom cannot open another page.
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link, { metaKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
