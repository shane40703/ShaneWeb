import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunityPage } from './community-page';
import { lineCommunity, threadsProfile } from './community-links';
import nextConfig from '../../../next.config';

afterEach(cleanup);

const LINE_ITEMS = ['想要什麼新功能，進來許願', '用的時候遇到錯誤，進來說一聲', '對網站開發有興趣，一起來協作', '交流考試內容，互相解惑'];

describe('CommunityPage', () => {
  it.each(['line', 'threads'] as const)('shows only its own community on the %s page, with no sign-in or report form', (channel) => {
    const { container } = render(<CommunityPage channel={channel} />);
    expect(screen.getByRole('heading', { level: 2, name: '一起備考，也一起交流。' })).toBeVisible();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Firebase|問題類型|送出問題回報|使用 Google 登入/)).not.toBeInTheDocument();
  });

  it('says what LINE 社群 is for in exactly the four lines, as one list', () => {
    render(<CommunityPage channel="line" />);
    const card = screen.getByRole('article');
    expect(card).toHaveAccessibleName('LINE 社群');
    expect(within(card).getByRole('heading', { level: 3, name: 'LINE 社群' })).toBeVisible();
    expect(within(card).getByText('建築師大集結開源討論群')).toBeVisible();
    expect(within(card).getAllByRole('listitem').map(item => item.textContent)).toEqual(LINE_ITEMS);
    for (const text of ['掃描 QR Code，加入 LINE 社群', '使用手機瀏覽？直接點上方按鈕即可。'])
      expect(within(card).getByText(text)).toBeVisible();
    expect(screen.queryByText(/Threads/)).not.toBeInTheDocument();
  });

  it('introduces noki on the Threads page', () => {
    render(<CommunityPage channel="threads" />);
    const card = screen.getByRole('article');
    expect(card).toHaveAccessibleName('Threads');
    expect(within(card).getByRole('heading', { level: 3, name: 'Threads' })).toBeVisible();
    for (const text of [
      '@archi.exam_sup',
      '嗨，我是 noki。',
      '我也是正在準備建築師考試的考生，一邊備考，一邊把自己的練習方式做成這個網站。',
      '歡迎追蹤、分享解題心得。',
      '掃描 QR Code，加入交流',
    ]) expect(within(card).getByText(text)).toBeVisible();
    expect(within(card).queryByText(/告訴我你希望網站變得更好用/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LINE/)).not.toBeInTheDocument();
  });

  it.each([
    {
      channel: 'line', link: lineCommunity, href: 'https://line.me/ti/g2/OH11gDAPosXdZPLd4w4wCkQNHE6L-tZXjU7W0A',
      button: /^加入 LINE 社群連結/, qrLink: '開啟 LINE 社群「建築師大集結開源討論群」的邀請頁（另開新分頁）', qrAlt: 'LINE 社群的 QR Code',
    },
    {
      channel: 'threads', link: threadsProfile, href: 'https://www.threads.com/@archi.exam_sup',
      button: /^前往 Threads 連結/, qrLink: '開啟 archi.exam_sup 的 Threads 主頁（另開新分頁）', qrAlt: 'Threads 帳號 archi.exam_sup 的 QR Code',
    },
  ] as const)('gives the $channel page a safe button and QR link to one address', ({ channel, link, href, button, qrLink, qrAlt }) => {
    render(<CommunityPage channel={channel} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(button);
    expect(links[1]).toHaveAccessibleName(qrLink);
    for (const anchor of links) {
      expect(anchor).toHaveAttribute('href', href);
      expect(anchor).toHaveAttribute('target', '_blank');
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
      expect(anchor).toHaveAccessibleName(/另開新分頁/);
    }
    expect(screen.getByRole('img', { name: qrAlt })).toHaveAttribute('src', link.qrCode);
  });

  it('sends the old 社群連結 and 問題回報 addresses to LINE 社群', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({ source: '/report', destination: '/line', permanent: true });
    expect(redirects).toContainEqual({ source: '/community', destination: '/line', permanent: true });
  });
});
