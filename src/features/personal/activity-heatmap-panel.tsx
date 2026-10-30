import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { QuizAttempt } from '@/lib/types';
import { useOptionalAppState } from '@/state/app-state';
import { buildActivityHeatmap } from './activity-heatmap';
import styles from './activity-heatmap.module.css';

const weekdayLabels = ['', '一', '', '三', '', '五', ''];
const legendLevels = [0, 1, 2, 3, 4] as const;

function cellTooltip(date: string, count: number) {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}, ${count}題`;
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
  const heatmap = useMemo(
    () => (today ? buildActivityHeatmap(attempts, today) : null),
    [attempts, today],
  );
  const panelRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);

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

  // 格子之間的縫隙不算離開，提示才不會在相鄰兩格之間閃一下。
  function showTooltip(event: PointerEvent<HTMLDivElement>) {
    const cell = event.target as HTMLElement;
    const panel = panelRef.current;
    if (!cell.dataset.tooltip || !panel) return;
    const cellBox = cell.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    setTooltip({
      label: cell.dataset.tooltip,
      x: cellBox.left + cellBox.width / 2 - panelBox.left,
      y: cellBox.top - panelBox.top,
    });
  }

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      aria-labelledby="activity-heatmap-title"
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 id="activity-heatmap-title">
            近一年寫了 {heatmap?.totalQuestions ?? '—'} 題
          </h2>
          <p className={styles.stats}>
            <span>活動 {heatmap?.activeDays ?? '—'} 天</span>・
            <span>最長連續 {heatmap?.longestStreak ?? '—'} 天</span>
          </p>
        </div>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          onScroll={() => setTooltip(null)}
        >
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
                  onPointerOver={showTooltip}
                  onPointerLeave={() => setTooltip(null)}
                >
                  {heatmap.weeks.flatMap((week) =>
                    week.days.map((day) => (
                      <span
                        key={day.date}
                        className={styles.cell}
                        aria-hidden="true"
                        data-tooltip={cellTooltip(day.date, day.count)}
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
      {tooltip ? (
        <span
          className={styles.tooltip}
          style={{
            left: `clamp(56px, ${tooltip.x}px, calc(100% - 56px))`,
            top: tooltip.y,
          }}
          aria-hidden="true"
        >
          {tooltip.label}
        </span>
      ) : null}
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
