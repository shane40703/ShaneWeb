import { describe, expect, it } from 'vitest';
import type { QuizAttempt } from '@/lib/types';
import { buildActivityHeatmap, type ActivityHeatmapData } from './activity-heatmap';

const today = '2026-10-20'; // 週二

function attempt(
  submittedAt: string,
  correctCount: number,
  wrongCount = 0,
  unansweredCount = 0,
): QuizAttempt {
  return {
    id: `attempt-${submittedAt}-${correctCount}-${wrongCount}`,
    mode: 'practice',
    subject: 'law',
    year: null,
    questionIds: [],
    answers: {},
    startedAt: submittedAt,
    submittedAt,
    elapsedSeconds: 60,
    correctCount,
    wrongCount,
    unansweredCount,
  };
}

function allDays(heatmap: ActivityHeatmapData) {
  return heatmap.weeks.flatMap((week) => week.days);
}

function dayOf(heatmap: ActivityHeatmapData, date: string) {
  return allDays(heatmap).find((day) => day.date === date);
}

describe('buildActivityHeatmap', () => {
  it('buckets each attempt by its Taiwan calendar date', () => {
    const heatmap = buildActivityHeatmap(
      [
        attempt('2026-10-19T17:30:00.000Z', 3),
        attempt('2026-10-19T15:59:59.000Z', 2),
        attempt('2026-10-19T16:00:00.000Z', 1),
      ],
      today,
    );
    expect(dayOf(heatmap, '2026-10-19')?.count).toBe(2);
    expect(dayOf(heatmap, '2026-10-20')?.count).toBe(4);
  });

  it('counts answered questions only and sums every attempt of the same day', () => {
    const heatmap = buildActivityHeatmap(
      [
        attempt('2026-10-10T02:00:00.000Z', 30, 8, 12),
        attempt('2026-10-10T03:00:00.000Z', 40, 10),
        attempt('2026-10-10T04:00:00.000Z', 0, 0, 80),
      ],
      today,
    );
    expect(dayOf(heatmap, '2026-10-10')?.count).toBe(88);
    expect(heatmap.totalQuestions).toBe(88);
    expect(heatmap.activeDays).toBe(1);
  });

  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 2],
    [29, 2],
    [30, 3],
    [59, 3],
    [60, 4],
    [200, 4],
  ])('puts %i answered questions on level %i', (count, level) => {
    const heatmap = buildActivityHeatmap(
      [attempt('2026-10-10T02:00:00.000Z', count)],
      today,
    );
    expect(dayOf(heatmap, '2026-10-10')?.level).toBe(level);
  });

  it('finds the longest run of active days across week and month ends', () => {
    const activeDates = [
      '2026-08-29', // 週六，下一天換欄
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-10',
      '2026-10-19',
      '2026-10-20',
    ];
    const heatmap = buildActivityHeatmap(
      activeDates.map((date) => attempt(`${date}T02:00:00.000Z`, 1)),
      today,
    );
    expect(heatmap.longestStreak).toBe(4);
    expect(heatmap.activeDays).toBe(7);
  });

  it('counts nothing outside the grid', () => {
    const heatmap = buildActivityHeatmap(
      [
        attempt('2025-10-18T02:00:00.000Z', 50), // 第一欄之前
        attempt('2025-10-19T02:00:00.000Z', 1), // 第一欄的週日
        attempt('2026-10-21T02:00:00.000Z', 50), // 明天
      ],
      today,
    );
    expect(heatmap.totalQuestions).toBe(1);
    expect(heatmap.activeDays).toBe(1);
    expect(dayOf(heatmap, '2026-10-21')).toMatchObject({ count: 0, level: 0 });
  });

  it('lays out 53 Sunday-first columns of consecutive days ending on the current week', () => {
    const { weeks } = buildActivityHeatmap([], today);
    expect(weeks).toHaveLength(53);
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(weeks[0].days[0].date).toBe('2025-10-19');
    expect(weeks[52].days[0].date).toBe('2026-10-18');
    expect(weeks[52].days.map((day) => day.inRange)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(weeks[52].days[2].date).toBe(today);

    const times = weeks.flatMap((week) =>
      week.days.map((day) => Date.parse(`${day.date}T00:00:00Z`)),
    );
    expect(
      times.every((time, index) => !index || time - times[index - 1] === 86_400_000),
    ).toBe(true);
  });

  it.each([
    ['2026-10-18', 1], // 週日
    ['2026-10-24', 7], // 週六
  ])('keeps %s in the last column with %i day in range', (date, inRangeDays) => {
    const { weeks } = buildActivityHeatmap([], date);
    expect(weeks[52].days.filter((day) => day.inRange)).toHaveLength(inRangeDays);
    expect(weeks[52].days[inRangeDays - 1].date).toBe(date);
  });

  it('accepts a custom week count', () => {
    const { weeks } = buildActivityHeatmap([], today, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks[0].days[0].date).toBe('2026-09-27');
  });

  it('labels every month on its first column with no blank columns between months', () => {
    const { weeks, monthLabels } = buildActivityHeatmap([], today);
    expect(monthLabels).toEqual([
      { label: '11月', column: 2 },
      { label: '12月', column: 7 },
      { label: '1月', column: 11 },
      { label: '2月', column: 15 },
      { label: '3月', column: 19 },
      { label: '4月', column: 24 },
      { label: '5月', column: 28 },
      { label: '6月', column: 33 },
      { label: '7月', column: 37 },
      { label: '8月', column: 41 },
      { label: '9月', column: 46 },
      { label: '10月', column: 50 },
    ]);
    monthLabels.forEach(({ label, column }) => {
      const [, month, day] = weeks[column].days[0].date.split('-').map(Number);
      expect(label).toBe(`${month}月`);
      expect(day).toBeLessThanOrEqual(7);
    });
    monthLabels.slice(1).forEach(({ column }, index) => {
      expect(column - monthLabels[index].column).toBeGreaterThanOrEqual(4);
      expect(column - monthLabels[index].column).toBeLessThanOrEqual(5);
    });
  });

  it('skips attempts whose submittedAt does not parse', () => {
    const heatmap = buildActivityHeatmap(
      [
        attempt('not-a-date', 50),
        attempt('', 50),
        attempt('2026-10-10T02:00:00.000Z', 3),
      ],
      today,
    );
    expect(heatmap.totalQuestions).toBe(3);
    expect(heatmap.activeDays).toBe(1);
  });
});
