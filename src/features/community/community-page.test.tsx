import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunityPage } from './community-page';
import { threadsProfile } from './community-links';
import nextConfig from '../../../next.config';

afterEach(cleanup);

describe('CommunityPage', () => {
  it('shows the profile without requiring authentication, app state or a report form', () => {
    const { container } = render(<CommunityPage />);
    expect(screen.getByRole('heading', { name: '一起備考，也一起交流。' })).toBeVisible();
    expect(screen.getByText('@archi.exam_sup')).toBeVisible();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Firebase|問題類型|送出問題回報|使用 Google 登入/)).not.toBeInTheDocument();
  });

  it('provides accessible, safe links for both the button and the local QR image', () => {
    render(<CommunityPage />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', 'https://www.threads.com/@archi.exam_sup');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAccessibleName(/另開新分頁/);
    }
    expect(screen.getByRole('img', { name: /Threads.*QR Code/ }))
      .toHaveAttribute('src', threadsProfile.qrCode);
  });

  it('redirects old report URLs to the community page', async () => {
    expect(await nextConfig.redirects?.()).toContainEqual({
      source: '/report', destination: '/community', permanent: true,
    });
  });
});
