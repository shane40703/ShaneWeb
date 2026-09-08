import { useMemo, useState } from 'react';
import { IconChartLine } from '@tabler/icons-react';
import { getAnalysisCategory, getQuestionDisplayCategories } from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from './analysis-page.module.css';

type TrendDimension = 'category' | 'fine-topic';

interface TrendSeries {
  category: string;
  counts: number[];
  total: number;
}

const maxSelectedSeries = 6;

function questionTrendCategories(
  question: QuestionSummary,
  subjectId: SubjectId,
  dimension: TrendDimension,
) {
  if (subjectId === 'law' && dimension === 'fine-topic') {
    return question.fineTopic ? [question.fineTopic] : [];
  }
  if (subjectId === 'law') return getQuestionDisplayCategories(question);
  return [
    getAnalysisCategory(
      question.subject,
      question.topic,
      question.primaryCategory,
    ),
  ];
}

export function buildTrendSeries(
  questions: readonly QuestionSummary[],
  subjectId: SubjectId,
  selectedYears: readonly number[],
  dimension: TrendDimension,
) {
  const yearIndexes = new Map(selectedYears.map((year, index) => [year, index]));
  const counts = new Map<string, number[]>();

  questions.forEach((question) => {
    if (question.subject !== subjectId) return;
    const yearIndex = yearIndexes.get(question.year);
    if (yearIndex === undefined) return;
    questionTrendCategories(question, subjectId, dimension).forEach((category) => {
      const values = counts.get(category) ?? selectedYears.map(() => 0);
      values[yearIndex] += 1;
      counts.set(category, values);
    });
  });

  return [...counts.entries()]
    .map(([category, values]) => ({
      category,
      counts: values,
      total: values.reduce((sum, count) => sum + count, 0),
    }))
    .sort(
      (left, right) =>
        right.total - left.total || left.category.localeCompare(right.category, 'zh-Hant'),
    );
}

function LineChart({
  years,
  series,
}: {
  years: readonly number[];
  series: readonly (TrendSeries & { color: string })[];
}) {
  const width = 820;
  const height = 320;
  const margin = { top: 20, right: 24, bottom: 42, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maximum = Math.max(1, ...series.flatMap((item) => item.counts));
  const roundedMaximum = Math.max(4, Math.ceil(maximum / 4) * 4);
  const x = (index: number) =>
    margin.left + (years.length === 1 ? plotWidth / 2 : (index / (years.length - 1)) * plotWidth);
  const y = (value: number) => margin.top + plotHeight - (value / roundedMaximum) * plotHeight;
  const ticks = [0, 1, 2, 3, 4].map((step) => (roundedMaximum / 4) * step);

  return (
    <div className={styles.trendChartScroll}>
      <svg
        className={styles.trendChart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${years[0]} 年至 ${years.at(-1)} 年分類出題數量折線圖`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              className={styles.trendGridLine}
            />
            <text x={margin.left - 10} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {years.map((year, index) => (
          <text
            x={x(index)}
            y={height - 14}
            textAnchor="middle"
            key={year}
          >
            {year}
          </text>
        ))}
        {series.map((item) => {
          const points = item.counts
            .map((count, index) => `${x(index)},${y(count)}`)
            .join(' ');
          return (
            <g key={item.category}>
              <polyline
                points={points}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {item.counts.map((count, index) => (
                <circle
                  cx={x(index)}
                  cy={y(count)}
                  r="4"
                  fill={item.color}
                  key={`${years[index]}-${count}`}
                >
                  <title>{`${item.category}：${years[index]} 年 ${count} 題`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DetailedTrendAnalysis({
  questions,
  subjectId,
  years,
  colors,
}: {
  questions: readonly QuestionSummary[];
  subjectId: SubjectId;
  years: readonly number[];
  colors: readonly string[];
}) {
  const [dimension, setDimension] = useState<TrendDimension>('category');
  const selectionKey = `${subjectId}:${dimension}`;
  const [selectedByKey, setSelectedByKey] = useState<Record<string, string[]>>({});
  const allSeries = useMemo(
    () => buildTrendSeries(questions, subjectId, years, dimension),
    [dimension, questions, subjectId, years],
  );
  const storedSelection = selectedByKey[selectionKey];
  const selectedCategories = (storedSelection ?? allSeries.slice(0, 3).map((item) => item.category))
    .filter((category) => allSeries.some((item) => item.category === category));
  const selectedSeries = selectedCategories
    .map((category, index) => {
      const item = allSeries.find((candidate) => candidate.category === category);
      return item ? { ...item, color: colors[index % colors.length] } : undefined;
    })
    .filter((item): item is TrendSeries & { color: string } => Boolean(item));
  const selectedTotal = selectedSeries.reduce((sum, item) => sum + item.total, 0);
  const peak = selectedSeries
    .flatMap((item) =>
      item.counts.map((count, index) => ({
        category: item.category,
        count,
        year: years[index],
      })),
    )
    .sort((left, right) => right.count - left.count)[0];
  const largestChange = selectedSeries
    .map((item) => ({
      category: item.category,
      change: (item.counts.at(-1) ?? 0) - (item.counts[0] ?? 0),
    }))
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))[0];

  function toggleCategory(category: string) {
    const isSelected = selectedCategories.includes(category);
    if (!isSelected && selectedCategories.length >= maxSelectedSeries) return;
    setSelectedByKey((current) => ({
      ...current,
      [selectionKey]: isSelected
        ? selectedCategories.filter((item) => item !== category)
        : [...selectedCategories, category],
    }));
  }

  return (
    <details className={styles.detailedAnalysis}>
      <summary>
        <span>
          <IconChartLine size={20} stroke={2} aria-hidden="true" />
          <span>
            <strong>詳細趨勢分析</strong>
            <small>跨年度比較分類出題數量與變化</small>
          </span>
        </span>
        <b>
          <span className={styles.summaryClosed}>展開分析</span>
          <span className={styles.summaryOpen}>收合分析</span>
        </b>
      </summary>
      <div className={styles.trendBody}>
        <header className={styles.trendHeader}>
          <div>
            <span>TREND ANALYSIS</span>
            <h2>跨年度命題趨勢</h2>
            <p>{years[0]}～{years.at(-1)} 年；勾選最多 {maxSelectedSeries} 個項目進行比較。</p>
          </div>
          {subjectId === 'law' ? (
            <label>
              分析層級
              <select
                aria-label="趨勢分析層級"
                value={dimension}
                onChange={(event) => setDimension(event.target.value as TrendDimension)}
              >
                <option value="category">法規分類</option>
                <option value="fine-topic">人工細分考點</option>
              </select>
            </label>
          ) : null}
        </header>

        {allSeries.length ? (
          <>
            <div className={styles.trendPicker} aria-label="選擇比較分類">
              {allSeries.map((item) => {
                const selected = selectedCategories.includes(item.category);
                const disabled = !selected && selectedCategories.length >= maxSelectedSeries;
                return (
                  <label data-selected={selected || undefined} key={item.category}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleCategory(item.category)}
                    />
                    <span>{item.category}</span>
                    <small>{item.total} 題</small>
                  </label>
                );
              })}
            </div>

            {selectedSeries.length ? (
              <>
                <div className={styles.trendStats}>
                  <div>
                    <span>選取項目總標註</span>
                    <strong>{selectedTotal} 題次</strong>
                  </div>
                  <div>
                    <span>最高單年出題量</span>
                    <strong>{peak ? `${peak.year} 年・${peak.count} 題` : '—'}</strong>
                    <small>{peak?.category}</small>
                  </div>
                  <div>
                    <span>首末年度變化最大</span>
                    <strong>
                      {largestChange
                        ? `${largestChange.change > 0 ? '+' : ''}${largestChange.change} 題`
                        : '—'}
                    </strong>
                    <small>{largestChange?.category}</small>
                  </div>
                </div>

                <section className={styles.trendPanel} aria-label="跨年度分類折線圖">
                  <div className={styles.trendLegend}>
                    {selectedSeries.map((item) => (
                      <span key={item.category}>
                        <i style={{ background: item.color }} aria-hidden="true" />
                        {item.category}
                      </span>
                    ))}
                  </div>
                  <LineChart years={years} series={selectedSeries} />
                </section>

                <div className={styles.trendTable}>
                  <table>
                    <caption>各年度精確出題數</caption>
                    <thead>
                      <tr>
                        <th scope="col">年度</th>
                        {selectedSeries.map((item) => (
                          <th scope="col" key={item.category}>{item.category}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {years.map((year, yearIndex) => (
                        <tr key={year}>
                          <th scope="row">{year} 年</th>
                          {selectedSeries.map((item) => (
                            <td key={item.category}>{item.counts[yearIndex]} 題</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className={styles.trendEmpty}>請至少勾選一個分類以顯示趨勢。</p>
            )}
          </>
        ) : (
          <p className={styles.trendEmpty}>此分析層級目前沒有可用資料。</p>
        )}
      </div>
    </details>
  );
}
