import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrivacyPage } from './privacy-page';

afterEach(cleanup);

describe('PrivacyPage', () => {
  it('leaves the page title to the topbar and lists its sections in order', () => {
    render(<PrivacyPage />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      '存在你的瀏覽器',
      '登入後同步的資料',
      '你送出的內容',
      '使用統計',
      '不想被統計',
      '聯絡方式',
    ]);
  });

  it.each([
    [
      'Google 如何使用這些資料 ↗',
      'https://policies.google.com/technologies/partner-sites?hl=zh-TW',
    ],
    ['Google Analytics 停用外掛 ↗', 'https://tools.google.com/dlpage/gaoptout?hl=zh-TW'],
  ])('opens %s in a new tab', (name, href) => {
    render(<PrivacyPage />);

    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('sends questions to the Threads page inside the site', () => {
    render(<PrivacyPage />);

    const link = screen.getByRole('link', { name: 'Threads' });
    expect(link).toHaveAttribute('href', '/threads');
    expect(link).not.toHaveAttribute('target');
  });

  it('keeps the words around its inline links', () => {
    render(<PrivacyPage />);

    expect(document.body).toHaveTextContent(
      '可以安裝 Google 提供的 Google Analytics 停用外掛 ↗，或使用會阻擋統計工具的瀏覽器擴充功能。兩種方式都不影響網站功能。',
    );
    expect(document.body).toHaveTextContent(
      '對隱私權有疑問，或想刪除雲端上的資料，請到 Threads 告訴我們。本政策更新時會修改上方日期。',
    );
  });

  it('says what leaves the browser beyond the synced study data', () => {
    render(<PrivacyPage />);

    expect(document.body).toHaveTextContent(
      '把筆記分享到討論版時，圖片會一起上傳並公開顯示。',
    );
    expect(document.body).toHaveTextContent(
      'Firebase 會保存你 Google 帳號的 Email、名稱和大頭貼',
    );
    expect(document.body).toHaveTextContent('能看出哪些投稿、回覆和按讚來自同一個帳號。');
  });
});
