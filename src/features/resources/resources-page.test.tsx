import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResourcesOverview } from './resources-overview';
import { ResourcesPage } from './resources-page';

afterEach(cleanup);

const overview: ResourcesOverview = {
  questions: { total: 3600, subjectCount: 4, firstYear: 100, lastYear: 114 },
  gallery: {
    total: 3,
    latest: [
      {
        id: 'a',
        title: '樓梯設置規定',
        thumbnailSrc: '/memory-gallery/assets/a-thumb.webp',
        width: 1055,
        height: 1491,
      },
      {
        id: 'b',
        title: '樁分類',
        thumbnailSrc: '/memory-gallery/assets/b-thumb.webp',
        width: 1055,
        height: 1491,
      },
    ],
  },
  laws: {
    total: 74,
    top: [
      { name: '建築技術規則', questionCount: 313 },
      { name: '政府採購法', questionCount: 124 },
    ],
  },
};

describe('ResourcesPage', () => {
  it('presents the three resources in study order, each titled by a link to its page', () => {
    render(<ResourcesPage overview={overview} />);

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['考題分析', '速記圖庫', '法規資料庫']);
    expect(within(cards[0]).getByRole('link', { name: '考題分析' })).toHaveAttribute(
      'href',
      '/resources/analysis',
    );
    expect(within(cards[1]).getByRole('link', { name: '速記圖庫' })).toHaveAttribute(
      'href',
      '/resources/memory-gallery',
    );
    expect(within(cards[2]).getByRole('link', { name: '法規資料庫' })).toHaveAttribute(
      'href',
      '/resources/laws',
    );
    expect(screen.getByText('3,600')).toBeInTheDocument();
    expect(screen.getByText('100–114')).toBeInTheDocument();
    expect(within(cards[0]).getByText('4 科・100–114 年')).toBeInTheDocument();
    expect(within(cards[1]).getByText('共 3 張整理圖')).toBeInTheDocument();
    expect(within(cards[2]).getByText('收錄 74 項法規')).toBeInTheDocument();
  });

  it('marks the overview as the current page of the section switcher', () => {
    render(<ResourcesPage overview={overview} />);

    const sections = screen.getByRole('navigation', { name: '統計分析頁面' });
    expect(within(sections).getByRole('link', { name: '總覽' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(sections)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/resources',
      '/resources/analysis',
      '/resources/memory-gallery',
      '/resources/laws',
    ]);
  });

  it('leads to each page only through its card, with nothing off the site', () => {
    render(<ResourcesPage overview={overview} />);

    for (const card of screen.getAllByRole('article')) {
      expect(within(card).getAllByRole('link')).toHaveLength(1);
    }
    expect(
      screen.queryByRole('link', { name: /全國法規資料庫/ }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link')
        .filter((link) => /^https?:/.test(link.getAttribute('href') ?? '')),
    ).toHaveLength(0);
  });

  it('describes 考題分析 in words instead of listing its subjects', () => {
    render(<ResourcesPage overview={overview} />);

    const card = screen.getByRole('article', { name: '考題分析' });
    expect(
      within(card).getByText('選科目與年度，查看命題分布、歷年趨勢與對應考古題。'),
    ).toBeInTheDocument();
    expect(
      within(card).queryByText(/建築法規與實務|建築環境控制|建築構造與施工|建築結構/),
    ).not.toBeInTheDocument();
  });

  it('previews the newest images without linking them, and blocks saving', () => {
    render(<ResourcesPage overview={overview} />);

    const card = screen.getByRole('article', { name: '速記圖庫' });
    const images = within(card).getAllByRole('img');
    expect(images.map((image) => image.getAttribute('alt'))).toEqual([
      '樓梯設置規定',
      '樁分類',
    ]);
    expect(images[1]).toHaveAttribute('src', '/memory-gallery/assets/b-thumb.webp');
    expect(images[1]).toHaveAttribute('draggable', 'false');
    expect(images[1].closest('a')).toBeNull();
    expect(fireEvent.contextMenu(images[1])).toBe(false);
    expect(fireEvent.dragStart(images[1])).toBe(false);
    // No subject shortcuts beside them.
    expect(within(card).queryByText(/張$|準備中/)).not.toBeInTheDocument();
  });

  it('lists the most cited laws as a preview, not as links', () => {
    render(<ResourcesPage overview={overview} />);

    const card = screen.getByRole('article', { name: '法規資料庫' });
    const laws = within(card).getAllByRole('listitem');
    expect(laws.map((law) => law.textContent)).toEqual([
      '1建築技術規則 313 題',
      '2政府採購法 124 題',
    ]);
    expect(laws.every((law) => law.querySelector('a') === null)).toBe(true);
  });

  it('explains empty resources instead of showing blank previews', () => {
    render(
      <ResourcesPage
        overview={{
          ...overview,
          gallery: { total: 0, latest: [] },
          laws: { total: 0, top: [] },
        }}
      />,
    );

    expect(
      screen.getByText('管理者上傳整理圖後，最新的圖片會顯示在這裡。'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('題庫標註法規後，最常考的法規會列在這裡。'),
    ).toBeInTheDocument();
    expect(screen.getByText('整理圖準備中')).toBeInTheDocument();
    expect(screen.getByText('法規準備中')).toBeInTheDocument();
  });
});
