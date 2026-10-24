import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ResourceLayout } from './resource-layout';

afterEach(cleanup);

describe('ResourceLayout', () => {
  it.each([
    ['analysis', '考題分析', '哪些主題最常考、歷年怎麼變。'],
    ['memory-gallery', '速記圖庫', '考前快速翻的整理圖。'],
    ['laws', '法規資料庫', '考過的法規，直接查原文。'],
  ] as const)(
    'marks %s as the current page and leads with its summary',
    (current, label, summary) => {
      render(
        <ResourceLayout current={current}>
          <p>頁面內容</p>
        </ResourceLayout>,
      );

      const sections = screen.getByRole('navigation', { name: '歷屆試題資料集成頁面' });
      const links = within(sections).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        '總覽',
        '考題分析',
        '速記圖庫',
        '法規資料庫',
      ]);
      expect(
        links.filter((link) => link.getAttribute('aria-current') === 'page'),
      ).toEqual([within(sections).getByRole('link', { name: label })]);
      expect(screen.getByText(summary)).toBeInTheDocument();
      expect(screen.getByText('頁面內容')).toBeInTheDocument();
    },
  );

  it('reads live figures before the shared detail sentence and adds actions beside the switcher', () => {
    render(
      <ResourceLayout
        current="laws"
        facts="收錄考題曾出現的 74 項法規；"
        actions={<button type="button">額外動作</button>}
      >
        <p>頁面內容</p>
      </ResourceLayout>,
    );

    expect(screen.getByText(/收錄考題曾出現的 74 項法規；/)).toHaveTextContent(
      '考過的法規，直接查原文。收錄考題曾出現的 74 項法規；點法規會在新分頁開啟法務部全國法規資料庫的搜尋結果。',
    );
    expect(screen.getByRole('button', { name: '額外動作' })).toBeInTheDocument();
  });

  it('collapses an action that renders nothing, such as the upload link on the public site', () => {
    const { container } = render(
      <ResourceLayout current="memory-gallery" actions={<>{null}</>}>
        <p>頁面內容</p>
      </ResourceLayout>,
    );

    const actions = container.querySelector('nav')!.nextElementSibling!;
    expect(actions).toBeEmptyDOMElement();
    expect(getComputedStyle(actions).display).toBe('none');
  });

  it('leaves the lead to the hub itself on the overview', () => {
    render(
      <ResourceLayout current="overview">
        <p>總覽內容</p>
      </ResourceLayout>,
    );

    expect(
      within(screen.getByRole('navigation', { name: '歷屆試題資料集成頁面' })).getByRole('link', {
        name: '總覽',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText(/哪些主題最常考/)).not.toBeInTheDocument();
  });
});
