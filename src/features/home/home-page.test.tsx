import { act, cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getExamCountdown, getExamSchedule, getTaipeiDate } from './exam-countdown';
import { HomePage } from './home-page';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('HomePage exam countdown', () => {
  it('shows a large countdown before the subject cards and a fresh daily-practice shortcut', () => {
    render(<HomePage today="2026-10-26" />);
    const exam = getExamSchedule(2026);
    const countdown = screen.getByRole('region', { name: exam.name });
    expect(within(countdown).getByText('19')).toBeInTheDocument();
    expect(within(countdown).getByText('2026 年 11 月 14 日')).toHaveAttribute('datetime', '2026-11-14');
    expect(within(countdown).getByRole('link')).toHaveAttribute('href', exam.source);
    expect(countdown).not.toHaveTextContent('預估日期');
    expect(screen.getByRole('link', { name: /每日抽題練習/ })).toHaveAttribute('href', '/practice/quiz');
    expect(screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/practice/mock-exam'))).toHaveLength(4);
    expect(screen.queryByRole('heading', { name: /近一年寫了/ })).not.toBeInTheDocument();
  });

  it.each([
    ['2026-11-13', 'before', 1], ['2026-11-14', 'ongoing', 1],
    ['2026-11-15', 'ongoing', 2], ['2026-11-16', 'ongoing', 3],
  ] as const)('handles exam boundary %s without a negative countdown', (date, phase, days) => {
    expect(getExamCountdown(date)).toMatchObject({ phase, days, exam: getExamSchedule(2026) });
    render(<HomePage today={date} />);
    const countdown = screen.getByRole('region', { name: '115 年建築師考試' });
    expect(countdown).toHaveTextContent(phase === 'ongoing' ? '舉行中' : '距離考試還有');
    if (phase === 'ongoing') expect(countdown).toHaveTextContent('願你沉著應試，發揮實力，順利上榜！');
  });

  it('switches to the next exam immediately after the last day, including subsequent years', () => {
    const next = getExamSchedule(2027);
    expect(next).toMatchObject({
      startsOn: '2027-11-20',
      endsOn: '2027-11-22',
      estimated: false,
      source: 'https://wwwc.moex.gov.tw/main/exam/wFrmExamDetail.aspx?c=116180',
    });
    const result = getExamCountdown('2026-11-17');
    expect(result).toMatchObject({ phase: 'before', exam: next });
    expect(result.days).toBe((Date.parse(`${next.startsOn}T00:00:00Z`) - Date.parse('2026-11-17T00:00:00Z')) / 86_400_000);
    render(<HomePage today="2026-11-17" />);
    const countdown = screen.getByRole('region', { name: '116 年建築師考試' });
    expect(countdown.querySelector('time')).toHaveAttribute('datetime', next.startsOn);
    expect(countdown).not.toHaveTextContent('本次考試已結束');
    expect(countdown).not.toHaveTextContent('預估日期');
    expect(within(countdown).getByRole('link')).toHaveAttribute('href', next.source);
    expect(getExamCountdown('2027-11-20')).toMatchObject({ phase: 'ongoing', days: 1, exam: next });
    expect(getExamCountdown('2027-11-22')).toMatchObject({ phase: 'ongoing', days: 3, exam: next });
    expect(getExamCountdown('2027-11-23')).toMatchObject({ phase: 'before', exam: getExamSchedule(2028) });
    const yearAfter = getExamSchedule(2028);
    expect(getExamCountdown('2027-12-31')).toMatchObject({ phase: 'before', exam: yearAfter });
    expect(getExamCountdown('2028-01-01').exam).toEqual(yearAfter);
  });

  it('marks later projected dates as estimates and keeps the official schedule link', () => {
    const schedule = getExamSchedule(2031);
    expect(schedule).toMatchObject({ startsOn: '2031-11-15', endsOn: '2031-11-17', estimated: true });
    render(<HomePage today="2030-11-20" />);
    const countdown = screen.getByRole('region', { name: '120 年建築師考試' });
    expect(countdown).toHaveTextContent('預估日期，請以考選部公告為準');
    expect(within(countdown).getByRole('link')).toHaveAttribute('href', schedule.source);
    expect(new Date(`${schedule.startsOn}T00:00:00Z`).getUTCDay()).toBe(6);
    expect(new Date(`${schedule.endsOn}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it('does not claim an unconfirmed estimated exam is actually underway', () => {
    render(<HomePage today="2031-11-15" />);
    const countdown = screen.getByRole('region', { name: '120 年建築師考試' });
    expect(countdown).toHaveTextContent('預估考期');
    expect(countdown).toHaveTextContent('預估日期，請以考選部公告為準');
    expect(countdown).not.toHaveTextContent('舉行中');
    expect(countdown).toHaveTextContent('願你沉著應試');
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
    expect(screen.getByText('舉行中')).toBeInTheDocument();
    act(() => { vi.setSystemTime(new Date('2026-11-16T16:00:00Z')); window.dispatchEvent(new Event('focus')); });
    expect(screen.getByRole('heading', { name: '116 年建築師考試' })).toBeInTheDocument();
  });

  it('prerenders a neutral loading state without freezing the build-year date', () => {
    const html = renderToString(<HomePage />);
    expect(html).toContain('正在讀取考試日期');
    expect(html).not.toContain('2026-11-14');
    expect(html).toContain('href="/practice/quiz"');
    expect(html).toContain('<strong>—</strong>');
  });
});
