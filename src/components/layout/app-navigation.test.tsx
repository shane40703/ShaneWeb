import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigationPageTitle, SidebarContent } from './app-navigation';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const personal = {
  label: '我的作答存摺',
  links: [
    ['我的筆記', '/notes'],
    ['難題標記', '/difficult'],
    ['常錯題目', '/wrong'],
    ['每日練習履歷', '/practice-history'],
    ['歷屆試題作答履歷', '/history'],
  ],
};

describe('grouped app navigation', () => {
  it('lists only the new pages, then 我的作答存摺, and uses only the brand as the home link', () => {
    render(<SidebarContent pathname="/" />);
    const nav = screen.getByRole('navigation', { name: '主要功能' });
    expect(nav.children[0]).toHaveTextContent(/^每日練習$/);
    expect(nav.children[1]).toHaveTextContent(/^考古題討論版$/);
    expect(nav.children[2]).toHaveTextContent(/^歷屆試題資料集成$/);
    expect(nav.children[3]).toHaveTextContent(/^我的作答存摺$/);
    expect(screen.queryByRole('link', { name: '首頁' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '建築師考試首頁' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/practice', '/exams', '/resources', '/settings', '/report']);
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([personal.label]);
  });

  it('opens the exact links in 我的作答存摺 and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<SidebarContent pathname="/" />);
    const trigger = screen.getByRole('button', { name: personal.label });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    const popup = await screen.findByRole('group', { name: `${personal.label}子選單` });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(popup)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual(personal.links);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('group', { name: `${personal.label}子選單` }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes the open section when the route changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SidebarContent pathname="/" />);
    await user.click(screen.getByRole('button', { name: personal.label }));
    await screen.findByRole('group', { name: `${personal.label}子選單` });
    rerender(<SidebarContent pathname="/notes" />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: personal.label })).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  it('highlights the current child and parent and closes the submenu after navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<SidebarContent pathname="/history" onNavigate={onNavigate} />);
    const trigger = screen.getByRole('button', { name: personal.label });
    expect(trigger).toHaveAttribute('data-active', 'true');
    await user.click(trigger);
    const link = await screen.findByRole('link', { name: '歷屆試題作答履歷' });
    expect(link).toHaveAttribute('aria-current', 'page');
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
  });

  it('opens a section from the keyboard with its first link focused', async () => {
    const user = userEvent.setup();
    render(<SidebarContent pathname="/notes" />);
    const trigger = screen.getByRole('button', { name: personal.label });
    trigger.focus();
    await user.keyboard('{Enter}');
    const notes = await screen.findByRole('link', { name: '我的筆記' });
    await waitFor(() => expect(notes).toHaveFocus());
    expect(notes).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the resources hub current on its pages', () => {
    render(<SidebarContent pathname="/resources/laws" />);
    const hub = screen.getByRole('link', { name: '歷屆試題資料集成' });
    expect(hub).toHaveAttribute('href', '/resources');
    expect(hub).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: personal.label })).not.toHaveAttribute(
      'data-active',
    );
  });

  it('keeps settings as a dialog action and closes the drawer when the brand is selected', () => {
    const onNavigate = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <SidebarContent
        pathname="/practice"
        inDrawer
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings}
      />,
    );
    expect(fireEvent.click(screen.getByRole('link', { name: '設定' }))).toBe(false);
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    const brand = screen.getByRole('link', { name: '建築師考試首頁' });
    brand.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(brand);
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it.each(['/practice', '/practice/quiz', '/practice/law-cloze', '/practice/mock-exam'])(
    'keeps 每日練習 current on %s',
    (pathname) => {
      render(<SidebarContent pathname={pathname} />);
      expect(screen.getByRole('link', { name: '每日練習' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: '考古題討論版' })).not.toHaveAttribute(
        'aria-current',
      );
    },
  );

  it.each([
    ['/', '首頁'],
    ['/practice', '每日練習'],
    ['/practice/quiz', '每日抽題練習'],
    ['/practice/law-cloze', '法規克漏字'],
    ['/practice/mock-exam', '歷屆試題模擬考'],
    ['/exams', '考古題討論版'],
    ['/resources', '歷屆試題資料集成'],
    ['/resources/analysis', '考題分析'],
    ['/resources/memory-gallery', '速記圖庫'],
    ['/resources/memory-gallery/[[...category]]', '速記圖庫'],
    ['/resources/laws', '法規資料庫'],
    ['/notes', '我的筆記'],
    ['/difficult', '難題標記'],
    ['/wrong', '常錯題目'],
    ['/history', '歷屆試題作答履歷'],
    ['/practice-history', '每日練習履歷'],
    ['/settings', '設定'],
    ['/appearance', '設定'],
    ['/report', '問題回報'],
    ['/unknown', '建築師考試'],
  ])('preserves the topbar title for %s', (pathname, title) => {
    expect(navigationPageTitle(pathname)).toBe(title);
  });

  it.each([
    '/daily',
    '/papers',
    '/random',
    '/law-cloze',
    '/analysis',
    '/memory-gallery',
    '/laws',
    '/community',
    '/questions/law/114/01',
  ])('names no removed page in the topbar: %s', (pathname) => {
    expect(navigationPageTitle(pathname)).toBe('建築師考試');
  });
});
