import { act, cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { QuizAttempt } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';
import { ARCHITECT_EXAM, getExamCountdown, getTaipeiDate } from './exam-countdown';
import { HomePage } from './home-page';

afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); });

describe('HomePage exam countdown', () => {
  it('shows a large countdown before the subject cards and a fresh daily-practice shortcut', () => {
    render(<HomePage today="2026-10-26" />);
    const countdown = screen.getByRole('region', { name: ARCHITECT_EXAM.name });
    expect(within(countdown).getByText('19')).toBeInTheDocument();
    expect(within(countdown).getByText('2026 年 11 月 14 日')).toHaveAttribute('datetime', '2026-11-14');
    expect(within(countdown).getByRole('link')).toHaveAttribute('href', ARCHITECT_EXAM.source);
    expect(screen.getByRole('link', { name: /每日抽題練習/ })).toHaveAttribute('href', '/practice/quiz');
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/practice/mock-exam'))).toHaveLength(4);
  });

  it.each([
    ['2026-11-13', 'before', 1], ['2026-11-14', 'ongoing', 1],
    ['2026-11-15', 'ongoing', 2], ['2026-11-16', 'ongoing', 3], ['2026-11-17', 'finished', 0],
  ] as const)('handles exam boundary %s without a negative countdown', (date, phase, days) => {
    expect(getExamCountdown(date)).toEqual({ phase, days });
    render(<HomePage today={date} />);
    const countdown = screen.getByRole('region', { name: ARCHITECT_EXAM.name });
    if (phase === 'finished') expect(countdown).toHaveTextContent('本次考試已結束');
    else expect(countdown).toHaveTextContent(phase === 'ongoing' ? '考試進行中' : '距離考試還有');
  });

  it('uses the Taiwan calendar day even when the visitor is elsewhere', () => {
    expect(getTaipeiDate(new Date('2026-11-13T15:59:59Z'))).toBe('2026-11-13');
    expect(getTaipeiDate(new Date('2026-11-13T16:00:00Z'))).toBe('2026-11-14');
  });

  it('refreshes across Taiwan midnight without reloading the page', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T15:59:30Z'));
    render(<HomePage />);
    expect(screen.getByText('距離考試還有')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('考試進行中・第')).toBeInTheDocument();
  });

  it('prerenders the announced dates and shortcut without freezing the build date', () => {
    const html = renderToString(<HomePage />);
    expect(html).toContain('2026-11-14');
    expect(html).toContain('href="/practice/quiz"');
    expect(html).toContain('<strong>—</strong>');
  });
});

describe('HomePage activity heatmap', () => {
  const attempt = (id: string, submittedAt: string, correctCount: number, wrongCount: number): QuizAttempt => ({
    id, mode: 'practice', subject: 'law', year: null, questionIds: [], answers: {},
    startedAt: submittedAt, submittedAt, elapsedSeconds: 60, correctCount, wrongCount, unansweredCount: 3,
  });

  it('sums the saved attempts between the countdown and the shortcut without adding links', async () => {
    const state = createDefaultState();
    state.attempts = [attempt('second', '2026-10-25T17:30:00.000Z', 18, 2), attempt('first', '2026-10-24T02:00:00.000Z', 7, 5)];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render(<ToastProvider><AppStateProvider><HomePage today="2026-10-26" /></AppStateProvider></ToastProvider>);

    const heading = await screen.findByRole('heading', { name: '過去一年作答 32 題' });
    expect(screen.getByRole('img')).toHaveAccessibleName('過去一年每天的作答題數熱力圖，共 32 題，2 天有作答');
    const countdown = screen.getByRole('region', { name: ARCHITECT_EXAM.name });
    const shortcut = screen.getByRole('link', { name: /每日抽題練習/ });
    expect(countdown.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(heading.compareDocumentPosition(shortcut)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(countdown).getAllByRole('link')).toHaveLength(1);
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/practice/mock-exam'))).toHaveLength(4);
  });

  it('stays empty without the app state provider', () => {
    render(<HomePage today="2026-10-26" />);
    expect(screen.getByRole('heading', { name: '過去一年作答 0 題' })).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('過去一年每天的作答題數熱力圖，共 0 題，0 天有作答');
  });
});
