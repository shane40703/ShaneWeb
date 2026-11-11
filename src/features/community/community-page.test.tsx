import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunityPage } from './community-page';
import { lineCommunity, threadsProfile } from './community-links';
import nextConfig from '../../../next.config';

afterEach(cleanup);

describe('CommunityPage', () => {
  it('shows both communities without requiring authentication, app state or a report form', () => {
    const { container } = render(<CommunityPage />);
    expect(screen.getByRole('heading', { name: '一起備考，也一起交流。' })).toBeVisible();
    expect(screen.getByText('在 Threads 追蹤網站動態；想交流考試內容、一起把網站做得更好，歡迎加入 LINE 社群。')).toBeVisible();
    expect(screen.getByText('@archi.exam_sup')).toBeVisible();
    expect(screen.getByText('建築師大集結開源討論群')).toBeVisible();
    expect(container.querySelector('form')).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Firebase|問題類型|送出問題回報|使用 Google 登入/)).not.toBeInTheDocument();
  });

  it('puts the LINE card below the Threads card, each labelled by its own heading', () => {
    render(<CommunityPage />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    const [threads, line] = cards;
    expect(threads).toHaveAccessibleName('Threads');
    expect(line).toHaveAccessibleName('LINE 社群');
    expect(threads.getAttribute('aria-labelledby')).not.toBe(line.getAttribute('aria-labelledby'));
    expect(within(threads).getByRole('heading', { level: 3, name: 'Threads' })).toBeVisible();
    expect(within(line).getByRole('heading', { level: 3, name: 'LINE 社群' })).toBeVisible();

    for (const text of [
      '嗨，我是 noki。',
      '我也是正在準備建築師考試的考生，一邊備考，一邊把自己的練習方式做成這個網站。',
      '歡迎追蹤、分享解題心得。',
      '掃描 QR Code，加入交流',
    ]) expect(within(threads).getByText(text)).toBeVisible();
    expect(within(threads).queryByText(/告訴我你希望網站變得更好用/)).not.toBeInTheDocument();

    // The LINE card says what the community is for in exactly these four lines, as one list.
    const items = within(line).getAllByRole('listitem');
    expect(items.map(item => item.textContent)).toEqual([
      '想要什麼新功能，進來許願',
      '用的時候遇到錯誤，進來說一聲',
      '對網站開發有興趣，一起來協作',
      '交流考試內容，互相解惑',
    ]);
    expect(within(line).queryByText('這是建築師大集結的開源社群。')).not.toBeInTheDocument();
    for (const text of ['掃描 QR Code，加入 LINE 社群', '使用手機瀏覽？直接點上方按鈕即可。'])
      expect(within(line).getByText(text)).toBeVisible();
  });

  it('provides accessible, safe links for both buttons and both local QR images', () => {
    render(<CommunityPage />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    const [threads, line] = screen.getAllByRole('article');
    const expected = [
      {
        card: threads,
        href: 'https://www.threads.com/@archi.exam_sup',
        names: [/^前往 Threads/, '開啟 archi.exam_sup 的 Threads 主頁（另開新分頁）'],
      },
      {
        card: line,
        href: 'https://line.me/ti/g2/OH11gDAPosXdZPLd4w4wCkQNHE6L-tZXjU7W0A',
        names: [/^加入 LINE 社群/, '開啟 LINE 社群「建築師大集結開源討論群」的邀請頁（另開新分頁）'],
      },
    ];
    for (const { card, href, names } of expected) {
      const links = within(card).getAllByRole('link');
      expect(links).toHaveLength(2);
      names.forEach((name, index) => expect(links[index]).toHaveAccessibleName(name));
      for (const link of links) {
        expect(link).toHaveAttribute('href', href);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAccessibleName(/另開新分頁/);
      }
    }
    expect(screen.getByRole('img', { name: 'Threads 帳號 archi.exam_sup 的 QR Code' }))
      .toHaveAttribute('src', threadsProfile.qrCode);
    expect(screen.getByRole('img', { name: 'LINE 社群的 QR Code' }))
      .toHaveAttribute('src', lineCommunity.qrCode);
  });

  it('redirects old report URLs to the community page', async () => {
    expect(await nextConfig.redirects?.()).toContainEqual({
      source: '/report', destination: '/community', permanent: true,
    });
  });
});
