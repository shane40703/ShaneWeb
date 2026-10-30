import type { QuizAttempt } from '@/lib/types';
import { getTaipeiDate } from './exam-countdown';

const dayMs = 86_400_000;

export interface ActivityDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
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
  if (count >= 60) return 4;
  if (count >= 30) return 3;
  if (count >= 10) return 2;
  return count > 0 ? 1 : 0;
}

/** 每個臺灣日期實際作答的題數；沒作答的題目不算，分段的作答紀錄會加總在同一天。 */
function countByTaipeiDate(attempts: QuizAttempt[]) {
  const counts = new Map<string, number>();
  attempts.forEach((attempt) => {
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
