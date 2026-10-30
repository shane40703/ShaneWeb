import { useLayoutEffect, useRef } from 'react';
import type { QuizAttempt } from '@/lib/types';
import { useOptionalAppState } from '@/state/app-state';
import { buildActivityHeatmap } from './activity-heatmap';
import styles from './activity-heatmap.module.css';

const weekdayLabels = ['', '一', '', '三', '', '五', ''];
const legendLevels = [0, 1, 2, 3, 4] as const;

function cellTitle(date: string, count: number) {
  const day = date.replaceAll('-', '/');
  return count ? `${day}・作答 ${count} 題` : `${day}・沒有作答`;
}

/**
 * 過去一年每天的作答題數。`today` 為 null（伺服器輸出、掛載前）時畫同樣大小的空格子，
 * 拿到臺灣日期後才填入，所以沒有 hydration 差異，也不會推動下方的內容。
 */
export function ActivityHeatmap({
  attempts,
  today,
}: {
  attempts: QuizAttempt[];
  today: string | null;
}) {
  const heatmap = today ? buildActivityHeatmap(attempts, today) : null;
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 手機放不下 53 週：一打開就停在最右邊先看到最近幾週，轉向或視窗變窄後也一樣。
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const showLatestWeeks = () => {
      scroller.scrollLeft = scroller.scrollWidth;
    };
    showLatestWeeks();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(showLatestWeeks);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [today]);

  return (
    <section className={styles.panel} aria-labelledby="activity-heatmap-title">
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 id="activity-heatmap-title">
            過去一年作答 {heatmap?.totalQuestions ?? '—'} 題
          </h2>
          <p className={styles.stats}>
            <span>活動天數 {heatmap?.activeDays ?? '—'} 天</span>・
            <span>最長連續 {heatmap?.longestStreak ?? '—'} 天</span>
          </p>
        </div>
        <div ref={scrollerRef} className={styles.scroller}>
          <div className={styles.chart}>
            <div className={styles.weekdays} aria-hidden="true">
              {weekdayLabels.map((label, row) => (
                <span key={row}>{label}</span>
              ))}
            </div>
            <div>
              <div className={styles.months} aria-hidden="true">
                {heatmap?.monthLabels.map(({ label, column }) => (
                  <span
                    key={column}
                    style={{
                      gridColumnStart: column + 1,
                      // 最後一欄的月份往左靠，字才不會超出格子把捲動範圍撐大。
                      justifySelf:
                        column === heatmap.weeks.length - 1 ? 'end' : undefined,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              {heatmap ? (
                <div
                  className={styles.days}
                  role="img"
                  aria-label={`過去一年每天的作答題數熱力圖，共 ${heatmap.totalQuestions} 題，${heatmap.activeDays} 天有作答`}
                >
                  {heatmap.weeks.flatMap((week) =>
                    week.days.map((day) => (
                      <span
                        key={day.date}
                        className={styles.cell}
                        aria-hidden="true"
                        title={cellTitle(day.date, day.count)}
                        data-level={day.level}
                        data-in-range={day.inRange}
                      />
                    )),
                  )}
                </div>
              ) : (
                <div className={styles.days} />
              )}
            </div>
          </div>
        </div>
        <p className={styles.legend} aria-hidden="true">
          少
          {legendLevels.map((level) => (
            <span key={level} className={styles.cell} data-level={level} />
          ))}
          多
        </p>
      </div>
    </section>
  );
}

/** 我的作答存摺用：讀本機作答存摺，沒有 Provider 或還沒讀到資料時就是空的格子。 */
export function ActivityHeatmapSection({ today }: { today: string | null }) {
  const app = useOptionalAppState();
  return (
    <ActivityHeatmap attempts={app?.hydrated ? app.state.attempts : []} today={today} />
  );
}
