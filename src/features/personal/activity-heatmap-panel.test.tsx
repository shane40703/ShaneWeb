import { cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuizAttempt } from '@/lib/types';
import { ActivityHeatmap } from './activity-heatmap-panel';

const today = '2026-10-20';
const attempts: QuizAttempt[] = [
  {
    id: 'attempt-1',
    mode: 'practice',
    subject: 'law',
    year: null,
    questionIds: [],
    answers: {},
    startedAt: '2026-10-19T02:00:00.000Z',
    submittedAt: '2026-10-19T02:10:00.000Z',
    elapsedSeconds: 600,
    correctCount: 7,
    wrongCount: 5,
    unansweredCount: 3,
  },
];

function cellsOf(container: HTMLElement) {
  return [...container.querySelectorAll('[role="img"] [data-level]')];
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ActivityHeatmap', () => {
  it('shows the totals, the 53-week grid and the legend', () => {
    const { container } = render(<ActivityHeatmap attempts={attempts} today={today} />);
    const panel = screen.getByRole('region', { name: '過去一年作答 12 題' });
    expect(within(panel).getByText('活動天數 1 天')).toBeInTheDocument();
    expect(within(panel).getByText('最長連續 1 天')).toBeInTheDocument();
    expect(cellsOf(container)).toHaveLength(53 * 7);
    expect(within(panel).getByText('11月')).toBeInTheDocument();
    ['一', '三', '五'].forEach((label) =>
      expect(within(panel).getByText(label)).toBeInTheDocument(),
    );
    const legend = within(panel).getByText(/少/);
    expect(legend).toHaveTextContent('少多');
    expect(legend.querySelectorAll('[data-level]')).toHaveLength(5);
  });

  it('labels each day and hides the days that have not happened yet', () => {
    const { container } = render(<ActivityHeatmap attempts={attempts} today={today} />);
    const cells = cellsOf(container);
    const answered = cells.find(
      (cell) => cell.getAttribute('title') === '2026/10/19・作答 12 題',
    );
    expect(answered).toHaveAttribute('data-level', '2');
    expect(answered).toHaveAttribute('aria-hidden', 'true');
    expect(
      cells.some((cell) => cell.getAttribute('title') === '2026/10/20・沒有作答'),
    ).toBe(true);
    expect(
      cells.filter((cell) => cell.getAttribute('data-in-range') === 'false'),
    ).toHaveLength(4);
  });

  it('describes the whole grid as one image without any clickable cell', () => {
    render(<ActivityHeatmap attempts={attempts} today={today} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '過去一年每天的作答題數熱力圖，共 12 題，1 天有作答',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('prerenders the same frame without cells until the Taiwan date is known', () => {
    const html = renderToString(<ActivityHeatmap attempts={attempts} today={null} />);
    expect(html).toContain('—');
    expect(html).not.toContain('data-in-range');
    expect(html).not.toContain('role="img"');
    expect(html).toContain('活動天數');
  });

  it('scrolls to the latest weeks once the date arrives after mount', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(820);
    const { container, rerender } = render(
      <ActivityHeatmap attempts={[]} today={null} />,
    );
    const scroller = container.querySelector('[class*="scroller"]')!;
    scroller.scrollLeft = 0;
    rerender(<ActivityHeatmap attempts={[]} today={today} />);
    expect(scroller.scrollLeft).toBe(820);
  });

  it('stays on the latest weeks when the panel gets narrower', () => {
    let resize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(820);
    const { container, unmount } = render(
      <ActivityHeatmap attempts={[]} today={today} />,
    );
    const scroller = container.querySelector('[class*="scroller"]')!;
    scroller.scrollLeft = 0;
    resize();
    expect(scroller.scrollLeft).toBe(820);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
