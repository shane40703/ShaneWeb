import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
    window.localStorage.clear();
  });

  it('switches themes and remembers the selected theme', async () => {
    document.documentElement.dataset.theme = 'light';
    const user = userEvent.setup();

    render(<ThemeToggle />);

    await user.click(
      await screen.findByRole('button', { name: '切換為深色模式' }),
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('shane-web-theme')).toBe('dark');
    expect(
      screen.getByRole('button', { name: '切換為淺色模式' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '切換為淺色模式' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('shane-web-theme')).toBe('light');
  });
});
