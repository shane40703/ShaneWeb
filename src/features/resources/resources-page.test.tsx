import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResourcesOverview } from './resources-overview';
import { ResourcesPage } from './resources-page';

afterEach(cleanup);

const overview: ResourcesOverview = {
  questions: { total: 3600, subjectCount: 4, firstYear: 100, lastYear: 114 },
  latestYears: [
    { subject: 'law', year: 114 },
    { subject: 'env', year: 113 },
    { subject: 'construction', year: 114 },
    { subject: 'structure', year: null },
  ],
  gallery: {
    total: 3,
    categories: [
      { id: 'law', count: 2 },
      { id: 'env', count: 0 },
      { id: 'construction', count: 1 },
      { id: 'structure', count: 0 },
    ],
    latest: [
      {
        id: 'a',
        title: '樓梯設置規定',
        category: 'law',
        thumbnailSrc: '/memory-gallery/assets/a-thumb.webp',
        width: 1055,
        height: 1491,
      },
      {
        id: 'b',
        title: '樁分類',
        category: 'construction',
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

  it('links each subject straight to its newest year and leaves an empty subject unlinked', () => {
    render(<ResourcesPage overview={overview} />);

    const card = screen.getByRole('article', { name: '考題分析' });
    expect(
      within(card).getByRole('link', { name: /^建築法規與實務\s*114 年\s*考題分析$/ }),
    ).toHaveAttribute('href', '/resources/analysis?subject=law&year=114');
    expect(
      within(card).getByRole('link', { name: /^建築環境控制\s*113 年\s*考題分析$/ }),
    ).toHaveAttribute('href', '/resources/analysis?subject=env&year=113');
    expect(
      within(card).queryByRole('link', { name: /建築結構/ }),
    ).not.toBeInTheDocument();
    expect(within(card).getByText('建築結構')).toBeInTheDocument();
  });

  it('opens a preview at its own image and a stocked subject at its page, and blocks saving', () => {
    render(<ResourcesPage overview={overview} />);

    const card = screen.getByRole('article', { name: '速記圖庫' });
    const preview = within(card).getByRole('link', { name: '樁分類' });
    expect(preview).toHaveAttribute(
      'href',
      '/resources/memory-gallery/construction#memory-b',
    );
    expect(within(preview).getByRole('img')).toHaveAttribute(
      'src',
      '/memory-gallery/assets/b-thumb.webp',
    );
    expect(within(preview).getByRole('img')).toHaveAttribute('draggable', 'false');
    expect(fireEvent.contextMenu(preview)).toBe(false);
    expect(fireEvent.dragStart(preview)).toBe(false);
    expect(within(card).getByRole('link', { name: /^法規\s*2 張$/ })).toHaveAttribute(
      'href',
      '/resources/memory-gallery',
    );
    expect(within(card).getAllByRole('link', { name: /張$/ })).toHaveLength(2);
    expect(
      within(card).queryByRole('link', { name: /環控|結構/ }),
    ).not.toBeInTheDocument();
    expect(within(card).getAllByText('準備中')).toHaveLength(2);
  });

  it('opens the most cited laws in the national laws database in a new tab', () => {
    render(<ResourcesPage overview={overview} />);

    const card = screen.getByRole('article', { name: '法規資料庫' });
    const links = within(card).getAllByRole('link', {
      name: /在新分頁開啟全國法規資料庫/,
    });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(
      /^建築技術規則\s*313 題\s*（在新分頁開啟全國法規資料庫）$/,
    );
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('law.moj.gov.tw'));
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0]).toHaveAttribute('rel', 'noreferrer');
  });

  it('explains empty resources instead of showing blank shortcuts', () => {
    render(
      <ResourcesPage
        overview={{
          ...overview,
          gallery: {
            total: 0,
            latest: [],
            categories: overview.gallery.categories.map((category) => ({
              ...category,
              count: 0,
            })),
          },
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
