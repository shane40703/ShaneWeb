import { useMemo, useState } from 'react';
import { IconChartLine } from '@tabler/icons-react';
import { getAnalysisCategory, getQuestionDisplayCategories } from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from './analysis-page.module.css';

type TrendDimension = 'category' | 'fine-topic';

export interface TrendSeries {
  category: string;
  counts: number[];
  total: number;
}

export interface ForecastRow {
  category: string;
  score: number;
  recentWeightedAverage: number;
  appearanceRate: number;
  momentum: number;
  lastSeenYear?: number;
  yearsWithoutAppearance: number | null;
  signal: '高頻且穩定' | '近期升溫' | '穩定出題' | '近期降溫' | '久未出題' | '間歇出題';
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

function average(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function buildForecastRanking(
  series: readonly TrendSeries[],
  years: readonly number[],
  targetYear = 115,
): ForecastRow[] {
  if (!series.length || !years.length) return [];

  const rawRows = series.map((item) => {
    const recentWindowSize = Math.min(3, item.counts.length);
    const recentCounts = item.counts.slice(-recentWindowSize);
    const previousCounts = item.counts.slice(
      Math.max(0, item.counts.length - recentWindowSize * 2),
      item.counts.length - recentWindowSize,
    );
    const recentWeightTotal = recentCounts.reduce((sum, _, index) => sum + index + 1, 0);
    const recentWeightedAverage = recentCounts.reduce(
      (sum, count, index) => sum + count * (index + 1),
      0,
    ) / recentWeightTotal;
    const momentum = previousCounts.length
      ? average(recentCounts) - average(previousCounts)
      : 0;
    const stabilityCounts = item.counts.slice(-Math.min(5, item.counts.length));
    const appearanceRate = stabilityCounts.filter((count) => count > 0).length
      / stabilityCounts.length;
    let lastSeenIndex = -1;
    item.counts.forEach((count, index) => {
      if (count > 0) lastSeenIndex = index;
    });
    const lastSeenYear = lastSeenIndex >= 0 ? years[lastSeenIndex] : undefined;

    return {
      category: item.category,
      recentWeightedAverage,
      appearanceRate,
      momentum,
      longTermAverage: item.total / years.length,
      lastSeenYear,
      yearsWithoutAppearance: lastSeenYear === undefined
        ? null
        : Math.max(0, targetYear - lastSeenYear - 1),
    };
  });
  const maximumRecent = Math.max(1, ...rawRows.map((item) => item.recentWeightedAverage));
  const maximumLongTerm = Math.max(1, ...rawRows.map((item) => item.longTermAverage));
  const maximumMomentum = Math.max(1, ...rawRows.map((item) => Math.abs(item.momentum)));

  return rawRows
    .map((item) => {
      const recentIndex = item.recentWeightedAverage / maximumRecent;
      const baselineIndex = item.longTermAverage / maximumLongTerm;
      const momentumIndex = clamp(0.5 + item.momentum / (maximumMomentum * 2));
      const score = Math.round(
        (recentIndex * 0.45
          + item.appearanceRate * 0.25
          + momentumIndex * 0.2
          + baselineIndex * 0.1) * 100,
      );
      let signal: ForecastRow['signal'] = '間歇出題';
      if (recentIndex >= 0.65 && item.appearanceRate >= 0.8) signal = '高頻且穩定';
      else if (item.momentum >= 0.5) signal = '近期升溫';
      else if (item.momentum <= -0.5) signal = '近期降溫';
      else if (item.appearanceRate >= 0.8) signal = '穩定出題';
      else if ((item.yearsWithoutAppearance ?? 0) >= 2) signal = '久未出題';

      return {
        category: item.category,
        score,
        recentWeightedAverage: Number(item.recentWeightedAverage.toFixed(1)),
        appearanceRate: item.appearanceRate,
        momentum: Number(item.momentum.toFixed(1)),
        lastSeenYear: item.lastSeenYear,
        yearsWithoutAppearance: item.yearsWithoutAppearance,
        signal,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.category.localeCompare(right.category, 'zh-Hant'),
    );
}

function LineChart({
  years,
  series,
  maximum,
}: {
  years: readonly number[];
  series: readonly (TrendSeries & { color: string })[];
  maximum: number;
}) {
  const width = 820;
  const yMaximum = Math.max(1, maximum);
  const margin = { top: 20, right: 24, bottom: 58, left: 62 };
  const height = Math.max(320, yMaximum * 18 + margin.top + margin.bottom);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index: number) =>
    margin.left + (years.length === 1 ? plotWidth / 2 : (index / (years.length - 1)) * plotWidth);
  const y = (value: number) => margin.top + plotHeight - (value / yMaximum) * plotHeight;
  const ticks = Array.from({ length: yMaximum + 1 }, (_, value) => value);
  const chartLabel = `${years[0]} 年至 ${years.at(-1)} 年分類出題數量折線圖`;

  return (
    <div className={styles.trendChartScroll}>
      <svg
        className={styles.trendChart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${chartLabel}${series.length ? '' : '，尚未選擇分類'}`}
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
            y={height - 30}
            textAnchor="middle"
            key={year}
          >
            {year}
          </text>
        ))}
        <text
          className={styles.trendAxisLabel}
          x={margin.left + plotWidth / 2}
          y={height - 8}
          textAnchor="middle"
        >
          年份
        </text>
        <text
          className={styles.trendAxisLabel}
          x={16}
          y={margin.top + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${margin.top + plotHeight / 2})`}
        >
          出題數（題）
        </text>
        {!series.length ? (
          <text
            className={styles.trendChartEmpty}
            x={margin.left + plotWidth / 2}
            y={margin.top + plotHeight / 2}
            textAnchor="middle"
          >
            勾選分類後顯示折線
          </text>
        ) : null}
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
  const [trendFromYear, setTrendFromYear] = useState(years[0] ?? 0);
  const [trendToYear, setTrendToYear] = useState(years.at(-1) ?? 0);
  const rangeStart = Math.min(trendFromYear, trendToYear);
  const rangeEnd = Math.max(trendFromYear, trendToYear);
  const analysisYears = useMemo(
    () => years.filter((year) => year >= rangeStart && year <= rangeEnd),
    [rangeEnd, rangeStart, years],
  );
  const selectionKey = `${subjectId}:${dimension}`;
  const [selectedByKey, setSelectedByKey] = useState<Record<string, string[]>>({});
  const allSeries = useMemo(
    () => buildTrendSeries(questions, subjectId, analysisYears, dimension),
    [analysisYears, dimension, questions, subjectId],
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
        year: analysisYears[index],
      })),
    )
    .sort((left, right) => right.count - left.count)[0];
  const largestChange = selectedSeries
    .map((item) => ({
      category: item.category,
      change: (item.counts.at(-1) ?? 0) - (item.counts[0] ?? 0),
    }))
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))[0];
  const forecastYear = 115;
  const forecastRows = buildForecastRanking(allSeries, analysisYears, forecastYear).slice(0, 10);
  const scopedQuestions = questions.filter(
    (question) => question.subject === subjectId && analysisYears.includes(question.year),
  );
  const classifiedQuestions = scopedQuestions.filter(
    (question) => questionTrendCategories(question, subjectId, dimension).length > 0,
  ).length;
  const classificationCoverage = scopedQuestions.length
    ? Math.round((classifiedQuestions / scopedQuestions.length) * 100)
    : 0;
  const chartMaximum = Math.max(1, ...allSeries.flatMap((item) => item.counts));

  function changeFromYear(nextYear: number) {
    setTrendFromYear(nextYear);
    if (nextYear > trendToYear) setTrendToYear(nextYear);
  }

  function changeToYear(nextYear: number) {
    setTrendToYear(nextYear);
    if (nextYear < trendFromYear) setTrendFromYear(nextYear);
  }

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
            <small>跨年度比較與 115 年複習優先度</small>
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
            <p>{analysisYears[0]}～{analysisYears.at(-1)} 年；勾選最多 {maxSelectedSeries} 個項目進行比較。</p>
          </div>
          <div className={styles.trendControls}>
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
            <fieldset className={styles.trendYearRange}>
              <legend>趨勢年份區間</legend>
              <label>
                起始年度
                <select
                  aria-label="趨勢起始年度"
                  value={rangeStart}
                  onChange={(event) => changeFromYear(Number(event.target.value))}
                >
                  {years.map((year) => <option value={year} key={year}>{year} 年</option>)}
                </select>
              </label>
              <span aria-hidden="true">至</span>
              <label>
                結束年度
                <select
                  aria-label="趨勢結束年度"
                  value={rangeEnd}
                  onChange={(event) => changeToYear(Number(event.target.value))}
                >
                  {years.map((year) => <option value={year} key={year}>{year} 年</option>)}
                </select>
              </label>
            </fieldset>
          </div>
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

            <div className={styles.trendStats} data-empty={!selectedSeries.length || undefined}>
              <div>
                <span>選取項目總標註</span>
                <strong>{selectedSeries.length ? `${selectedTotal} 題次` : '—'}</strong>
              </div>
              <div>
                <span>最高單年出題量</span>
                <strong>{peak ? `${peak.year} 年・${peak.count} 題` : '—'}</strong>
                <small>{peak?.category || '尚未選取分類'}</small>
              </div>
              <div>
                <span>首末年度變化最大</span>
                <strong>
                  {largestChange
                    ? `${largestChange.change > 0 ? '+' : ''}${largestChange.change} 題`
                    : '—'}
                </strong>
                <small>{largestChange?.category || '尚未選取分類'}</small>
              </div>
            </div>

            <section className={styles.trendPanel} aria-label="跨年度分類折線圖">
              <div className={styles.trendLegend}>
                {selectedSeries.length ? selectedSeries.map((item) => (
                  <span key={item.category}>
                    <i style={{ background: item.color }} aria-hidden="true" />
                    {item.category}
                  </span>
                )) : <span>尚未選取比較分類</span>}
              </div>
              <LineChart
                years={analysisYears}
                series={selectedSeries}
                maximum={chartMaximum}
              />
            </section>

            {selectedSeries.length ? (
              <>
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
                      {analysisYears.map((year, yearIndex) => (
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

                <section className={styles.forecastSection} aria-labelledby="forecast-heading">
                  <header className={styles.forecastHeader}>
                    <div>
                      <span>115 FOCUS INDEX</span>
                      <h3 id="forecast-heading">115 年複習優先度</h3>
                    </div>
                    <strong>{classificationCoverage}% 資料覆蓋率</strong>
                  </header>
                  <p className={styles.forecastNotice}>
                    依歷年題數產生的複習排序，不是命題機率；修法、時事與命題政策仍須另外判斷。
                  </p>
                  <div className={styles.forecastMethod} aria-label="複習優先指數組成">
                    <div><strong>45%</strong><span>近三年加權頻率</span></div>
                    <div><strong>25%</strong><span>近五年出題覆蓋</span></div>
                    <div><strong>20%</strong><span>近期升降趨勢</span></div>
                    <div><strong>10%</strong><span>全期平均題數</span></div>
                  </div>
                  <div className={styles.forecastTable}>
                    <table aria-label="115 年複習優先度">
                      <thead>
                        <tr>
                          <th scope="col">排名／考點</th>
                          <th scope="col">優先指數</th>
                          <th scope="col">近三年加權</th>
                          <th scope="col">近五年覆蓋</th>
                          <th scope="col">近期動能</th>
                          <th scope="col">最近出題</th>
                          <th scope="col">判讀</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastRows.map((item, index) => (
                          <tr key={item.category}>
                            <th scope="row">
                              <span>{index + 1}</span>
                              {item.category}
                            </th>
                            <td>
                              <div className={styles.forecastScore}>
                                <strong>{item.score}</strong>
                                <i aria-hidden="true">
                                  <b style={{ width: `${item.score}%` }} />
                                </i>
                              </div>
                            </td>
                            <td>{item.recentWeightedAverage} 題／年</td>
                            <td>{Math.round(item.appearanceRate * 100)}%</td>
                            <td data-tone={item.momentum > 0 ? 'up' : item.momentum < 0 ? 'down' : 'flat'}>
                              {item.momentum > 0 ? '+' : ''}{item.momentum} 題／年
                            </td>
                            <td>
                              {item.lastSeenYear
                                ? `${item.lastSeenYear} 年${item.yearsWithoutAppearance
                                  ? `（缺席 ${item.yearsWithoutAppearance} 年）`
                                  : ''}`
                                : '無紀錄'}
                            </td>
                            <td><span className={styles.forecastSignal}>{item.signal}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : (
          <p className={styles.trendEmpty}>此分析層級目前沒有可用資料。</p>
        )}
      </div>
    </details>
  );
}
