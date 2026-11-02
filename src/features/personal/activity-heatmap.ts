import type { QuizAttempt } from '@/lib/types';
import { getTaipeiDate } from '@/features/home/exam-countdown';
import { DAILY_ACTIVITY_RECORD_PREFIX, isDailyActivityRecord, isDailyPracticeRecord } from '@/features/practice/daily-practice-recording';

const dayMs = 86_400_000;
export const ACTIVITY_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Zero is separate; the tenth tier includes 181 and any higher count. */
export function activityLevelLabel(level: ActivityLevel) {
  if (level === 0) return '0 題，沒有作答';
  if (level === 10) return '181 題以上';
  return `${(level - 1) * 20 + 1}–${level * 20} 題`;
}

export interface ActivityDay {
  date: string;
  count: number;
  level: ActivityLevel;
  /** 今天之後的格子為 false：週格子排滿七天，但這些日子還沒到。 */
  inRange: boolean;
}

export interface ActivityHeatmapData {
  totalQuestions: number;
  activeDays: number;
  longestStreak: number;
  weeks: Array<{ days: ActivityDay[] }>;
  monthLabels: Array<{ label: string; column: number }>;
}

function levelOf(count: number): ActivityDay['level'] {
  return Math.min(10, Math.ceil(Math.max(0, count) / 20)) as ActivityLevel;
}

/** 每個臺灣日期實際作答的題數；沒作答的題目不算，分段的作答紀錄會加總在同一天。 */
function countByTaipeiDate(attempts: QuizAttempt[]) {
  const counts = new Map<string, number>();
  const activityIds = new Set(attempts.filter(isDailyActivityRecord).map((attempt) => attempt.id));
  attempts.forEach((attempt) => {
    // New daily completions have a count-only record even when full history is saved later.
    if (isDailyPracticeRecord(attempt) && activityIds.has(DAILY_ACTIVITY_RECORD_PREFIX + attempt.id)) return;
    const submittedAt = new Date(attempt.submittedAt);
    if (Number.isNaN(submittedAt.getTime())) return;
    const date = getTaipeiDate(submittedAt);
    counts.set(date, (counts.get(date) ?? 0) + attempt.correctCount + attempt.wrongCount);
  });
  return counts;
}

/**
 * GitHub 式的活動格子：每欄一週、週日開始，最後一欄是今天那一週。日期一律在 UTC 上
 * 計算 `YYYY-MM-DD`，結果才不會因為使用者所在的時區而不同。
 */
export function buildActivityHeatmap(
  attempts: QuizAttempt[],
  today: string,
  weeks = 53,
): ActivityHeatmapData {
  const counts = countByTaipeiDate(attempts);
  const todayTime = Date.parse(`${today}T00:00:00Z`);
  const lastSunday = todayTime - new Date(todayTime).getUTCDay() * dayMs;
  const firstSunday = lastSunday - (weeks - 1) * 7 * dayMs;
  const heatmap: ActivityHeatmapData = {
    totalQuestions: 0,
    activeDays: 0,
    longestStreak: 0,
    weeks: [],
    monthLabels: [],
  };
  let streak = 0;

  for (let column = 0; column < weeks; column += 1) {
    // 每欄的週日都在範圍內，所以週日落在當月 1–7 號的那一欄就是該月的第一欄。
    const sunday = new Date(firstSunday + column * 7 * dayMs);
    if (sunday.getUTCDate() <= 7) {
      heatmap.monthLabels.push({ label: `${sunday.getUTCMonth() + 1}月`, column });
    }

    const days: ActivityDay[] = [];
    for (let row = 0; row < 7; row += 1) {
      const time = sunday.getTime() + row * dayMs;
      const date = new Date(time).toISOString().slice(0, 10);
      const inRange = time <= todayTime;
      const count = inRange ? (counts.get(date) ?? 0) : 0;
      days.push({ date, count, level: levelOf(count), inRange });
      if (!inRange) continue;

      heatmap.totalQuestions += count;
      if (count > 0) heatmap.activeDays += 1;
      streak = count > 0 ? streak + 1 : 0;
      heatmap.longestStreak = Math.max(heatmap.longestStreak, streak);
    }
    heatmap.weeks.push({ days });
  }

  return heatmap;
}
