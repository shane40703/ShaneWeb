import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigationPageTitle, SidebarContent } from './app-navigation';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const sections = [
  { label: '歷屆試題題練習', links: [['歷屆試題', '/papers'], ['隨機出題', '/random'], ['法規克漏字', '/law-cloze']] },
  { label: '歷屆試題資料集成', links: [['考題分析', '/analysis'], ['速記圖庫', '/memory-gallery'], ['法規資料庫', '/laws']] },
  { label: '我的作答存摺', links: [['使用者筆記', '/notes'], ['難題標記', '/difficult'], ['常錯題目', '/wrong'], ['已作答紀錄', '/history']] },
];

describe('grouped app navigation', () => {
  it('starts with the new daily practice, past exams and resources hub, keeps discussion separate, and uses only the brand as the home link', () => {
    render(<SidebarContent pathname="/" />);
    const nav = screen.getByRole('navigation', { name: '主要功能' });
    expect(nav.firstElementChild).toHaveTextContent('每日練習（新版）');
    expect(nav.children[1]).toHaveTextContent(/^歷屆試題（新版）$/);
    expect(nav.children[2]).toHaveTextContent(/^統計分析（新版）$/);
    expect(nav.children[3]).toHaveTextContent(/^每日練習$/);
    expect(screen.queryByRole('link', { name: '首頁' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '建築師考試首頁' })).toHaveAttribute('href', '/');
    expect(within(nav).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/practice', '/exams', '/resources', '/daily', '/community', '/settings', '/report']);
    expect(within(nav).getAllByRole('button')).toHaveLength(3);
  });

  it.each(sections)('opens the exact links in $label and closes with Escape', async section => {
    const user = userEvent.setup();
    render(<SidebarContent pathname="/" />);
    const trigger = screen.getByRole('button', { name: section.label });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    const popup = await screen.findByRole('group', { name: `${section.label}子選單` });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(popup).getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])).toEqual(section.links);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('group', { name: `${section.label}子選單` })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('allows only one open section and clears it when the route changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SidebarContent pathname="/" />);
    await user.click(screen.getByRole('button', { name: sections[0].label }));
    await user.click(screen.getByRole('button', { name: sections[1].label }));
    await screen.findByRole('group', { name: `${sections[1].label}子選單` });
    expect(screen.queryByRole('group', { name: `${sections[0].label}子選單` })).not.toBeInTheDocument();
    rerender(<SidebarContent pathname="/notes" />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: sections[2].label })).toHaveAttribute('data-active', 'true');
  });

  it('highlights the current child and parent and closes the submenu after navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<SidebarContent pathname="/memory-gallery" onNavigate={onNavigate} />);
    const trigger = screen.getByRole('button', { name: sections[1].label });
    expect(trigger).toHaveAttribute('data-active', 'true');
    await user.click(trigger);
    const link = await screen.findByRole('link', { name: '速記圖庫' });
    expect(link).toHaveAttribute('aria-current', 'page');
    link.addEventListener('click', event => event.preventDefault());
    await user.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument());
  });

  it('keeps the resources hub current on its pages and wraps its （新版） note as one piece', () => {
    render(<SidebarContent pathname="/resources/laws" />);
    const hub = screen.getByRole('link', { name: '統計分析（新版）' });
    expect(hub).toHaveAttribute('href', '/resources');
    expect(hub).toHaveAttribute('aria-current', 'page');
    expect(within(hub).getByText('（新版）').tagName).toBe('SPAN');
    expect(screen.getByRole('button', { name: sections[1].label })).not.toHaveAttribute('data-active');
  });

  it('supports keyboard opening and treats question pages as part of paper practice', async () => {
    const user = userEvent.setup();
    render(<SidebarContent pathname="/questions/[subject]/[year]/[number]" />);
    const trigger = screen.getByRole('button', { name: sections[0].label });
    expect(trigger).toHaveAttribute('data-active', 'true');
    trigger.focus();
    await user.keyboard('{Enter}');
    const paper = await screen.findByRole('link', { name: '歷屆試題' });
    await waitFor(() => expect(paper).toHaveFocus());
    expect(paper).toHaveAttribute('aria-current', 'page');
  });

  it('keeps settings as a dialog action and closes the drawer when the brand is selected', () => {
    const onNavigate = vi.fn();
    const onOpenSettings = vi.fn();
    render(<SidebarContent pathname="/papers" inDrawer onNavigate={onNavigate} onOpenSettings={onOpenSettings} />);
    expect(fireEvent.click(screen.getByRole('link', { name: '設定' }))).toBe(false);
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledOnce();
    const brand = screen.getByRole('link', { name: '建築師考試首頁' });
    brand.addEventListener('click', event => event.preventDefault());
    fireEvent.click(brand);
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['/', '首頁'], ['/practice', '每日練習（新版）'], ['/exams', '歷屆試題（新版）'], ['/daily', '每日練習'], ['/papers', '歷屆試題'], ['/random', '隨機出題'], ['/law-cloze', '法規克漏字'],
    ['/analysis', '考題分析'], ['/memory-gallery', '速記圖庫'], ['/laws', '法規資料庫'], ['/community', '詳解與討論'],
    ['/resources', '統計分析（新版）'], ['/resources/analysis', '考題分析'], ['/resources/memory-gallery', '速記圖庫'], ['/resources/memory-gallery/[[...category]]', '速記圖庫'], ['/resources/laws', '法規資料庫'],
    ['/notes', '使用者筆記'], ['/difficult', '難題標記'], ['/wrong', '常錯題目'], ['/history', '已作答紀錄'],
    ['/settings', '設定'], ['/appearance', '設定'], ['/report', '問題回報'], ['/questions/law/114/01', '作答頁'], ['/unknown', '建築師考試'],
  ])('preserves the topbar title for %s', (pathname, title) => {
    expect(navigationPageTitle(pathname)).toBe(title);
  });
});
