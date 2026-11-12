import Link from 'next/link';
import { useRouter } from 'next/router';
import { type CSSProperties, useState } from 'react';
import {
  IconArrowRight,
  IconListCheck,
} from '@tabler/icons-react';
import { EmptyState } from '@/components/content/content';
import { Button } from '@/components/ui/ui';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import { years } from '@/question-bank/catalog';
import { analysisCategoryCatalog } from '@/question-bank/schema';
import {
  getAnalysis,
  getAnalysisCategory,
  getLawAnalysis,
  getQuestionDisplayCategories,
  isSubjectId,
  parseYear,
} from '@/lib/study';
import { examsQuestionHref } from '@/lib/question-path';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import { readStoredValue } from '@/lib/storage';
import { chartColors } from '@/lib/chart-colors';
import { practiceQuizPage } from '@/features/practice/practice-pages';
import {
  hasPracticeProgress,
  parsePracticeSession,
  practiceCategoryFor,
  PRACTICE_SESSION_STORAGE_KEY,
} from '@/features/practice/practice-session';
import { DetailedTrendAnalysis } from './detailed-trend-analysis';
import { useChartEntrance } from './use-chart-entrance';
import styles from './analysis-page.module.css';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AnalysisPage({
  questions,
  rowsLoading = false,
}: {
  questions: QuestionSummary[];
  /** The charts are ready; the rows' stems are still on their way. */
  rowsLoading?: boolean;
}) {
  const router = useRouter();
  const [distributionRef, distributionEntered] = useChartEntrance<HTMLDivElement>();
  const [pieRef, pieEntered] = useChartEntrance<HTMLDivElement>();
  const [categorySearch, setCategorySearch] = useState('');
  const querySubject = valueOf(router.query.subject);
  const subjectId: SubjectId = isSubjectId(querySubject) ? querySubject : 'law';
  const queryYear = valueOf(router.query.year);
  const parsedYear = parseYear(queryYear);
  const year: number | 'all' = queryYear === 'all' ? 'all' : parsedYear ?? 114;
  const availableYears = years.filter((candidateYear) =>
    questions.some(
      (question) => question.subject === subjectId && question.year === candidateYear,
    ),
  );
  const oldestAvailableYear = availableYears.at(-1) ?? years.at(-1)!;
  const newestAvailableYear = availableYears[0] ?? years[0];
  const parsedFromYear = parseYear(valueOf(router.query.fromYear));
  const parsedToYear = parseYear(valueOf(router.query.toYear));
  const fromYear =
    parsedFromYear && availableYears.includes(parsedFromYear)
      ? parsedFromYear
      : oldestAvailableYear;
  const toYear =
    parsedToYear && availableYears.includes(parsedToYear)
      ? parsedToYear
      : newestAvailableYear;
  const rangeStart = Math.min(fromYear, toYear);
  const rangeEnd = Math.max(fromYear, toYear);
  const trendYears = [...availableYears].reverse();
  const source = questions.filter(
    (question) =>
      question.subject === subjectId &&
      (year === 'all'
        ? question.year >= rangeStart && question.year <= rangeEnd
        : question.year === year),
  );
  const countedPrimaryAnalysis = getAnalysis(
    source.map((question) => ({
      primaryCategory: getAnalysisCategory(
        question.subject,
        question.topic,
        question.primaryCategory,
      ),
    })),
  );
  const primaryAnalysis = Object.keys(analysisCategoryCatalog[subjectId]).map(
    (category) =>
      countedPrimaryAnalysis.find((item) => item.category === category) ?? {
        category,
        count: 0,
        percentage: 0,
      },
  ).sort((left, right) => right.count - left.count);
  const lawAnalysis = getLawAnalysis(source);
  const analysis =
    subjectId === 'law'
      ? lawAnalysis.map(({ law, count, percentage }) => ({
          category: law,
          count,
          percentage,
        }))
      : primaryAnalysis;
  const analysisTotal = analysis.reduce((total, item) => total + item.count, 0);
  const categoryLabel = subjectId === 'law' ? '相關法規' : '命題分類';
  const [selectedCategoryValue, setSelectedCategoryValue] = useState<string>();
  const normalizedSearch = categorySearch.trim().normalize('NFKC').toLocaleLowerCase();
  const visibleAnalysis = analysis.filter((item) =>
    item.category.normalize('NFKC').toLocaleLowerCase().includes(normalizedSearch),
  );
  const selectedCategory = visibleAnalysis.some(
    (item) => item.category === selectedCategoryValue,
  )
    ? selectedCategoryValue
    : visibleAnalysis[0]?.category;
  const selectedCategoryQuestions = selectedCategory
    ? source.filter((question) =>
        subjectId === 'law'
          ? getQuestionDisplayCategories(question).includes(selectedCategory)
          : getAnalysisCategory(
              question.subject,
              question.topic,
              question.primaryCategory,
            ) === selectedCategory,
      )
    : [];
  const pieSegments = analysis.reduce(
    (result, item, index) => {
      const start = result.total;
      const end = start + item.percentage;
      result.parts.push(
        `${chartColors[index % chartColors.length]} ${start}% ${end}%`,
      );
      result.total = end;
      return result;
    },
    { total: 0, parts: [] as string[] },
  );

  function updateQuery(next: {
    subject?: SubjectId;
    year?: number | 'all';
    fromYear?: number;
    toYear?: number;
  }) {
    const nextYear = next.year ?? year;
    void router.replace(
      {
        pathname: router.pathname,
        query: {
          subject: next.subject ?? subjectId,
          year: String(nextYear),
          ...(nextYear === 'all'
            ? {
                fromYear: String(next.fromYear ?? fromYear),
                toYear: String(next.toYear ?? toYear),
              }
            : {}),
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function changeSubject(nextSubject: SubjectId) {
    setCategorySearch('');
    if (year === 'all') {
      const nextAvailableYears = years.filter((candidateYear) =>
        questions.some(
          (question) =>
            question.subject === nextSubject && question.year === candidateYear,
        ),
      );
      updateQuery({
        subject: nextSubject,
        fromYear: nextAvailableYears.at(-1) ?? years.at(-1)!,
        toYear: nextAvailableYears[0] ?? years[0],
      });
      return;
    }
    const nextAvailableYears = years.filter((candidateYear) =>
      questions.some(
        (question) =>
          question.subject === nextSubject && question.year === candidateYear,
      ),
    );
    updateQuery({
      subject: nextSubject,
      year: nextAvailableYears.includes(year) ? year : nextAvailableYears[0] ?? years[0],
    });
  }

  function changeYear(nextYear: SelectorYear) {
    updateQuery({ year: nextYear });
  }

  /**
   * Opens 每日抽題練習's setup with this subject, year range and category. A set in
   * progress would keep the setup from showing, so it goes first, after asking.
   */
  function practiceSelectedCategory() {
    if (!selectedCategoryQuestions.length) return;
    const current = parsePracticeSession(readStoredValue(PRACTICE_SESSION_STORAGE_KEY));
    if (
      current &&
      hasPracticeProgress(current) &&
      !window.confirm('目前的每日抽題練習還沒完成，要放棄並改用這個類別抽題嗎？作答進度會清除。')
    ) {
      return;
    }
    try {
      window.localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
    } catch {
      // Without storage there is no saved set to replace.
    }
    const category = practiceCategoryFor(selectedCategoryQuestions, selectedCategory);
    void router.push({
      pathname: practiceQuizPage.href,
      query: {
        subject: subjectId,
        from: String(year === 'all' ? rangeStart : year),
        to: String(year === 'all' ? rangeEnd : year),
        ...(category ? { category } : {}),
      },
    });
  }

  return (
    <>
      <QuestionSelector
        subjectId={subjectId}
        year={year}
        yearOptions={[
          { value: 'all', label: '跨年度' },
          ...years.map((candidateYear) => ({
            value: candidateYear,
            disabled: !availableYears.includes(candidateYear),
          })),
        ]}
        onSubjectChange={changeSubject}
        onYearChange={changeYear}
        ariaLabel="分析條件"
      />

      {year === 'all' ? (
        <section className={styles.yearRange} aria-label="跨年度年份區間">
          <div>
            <strong>跨年度區間</strong>
            <span>起訖年度都包含在分析範圍內。</span>
          </div>
          <label>
            起始年度
            <select
              aria-label="分析起始年度"
              value={fromYear}
              onChange={(event) =>
                updateQuery({ fromYear: Number(event.target.value) })
              }
            >
              {[...availableYears].reverse().map((candidateYear) => (
                <option key={candidateYear} value={candidateYear}>
                  {candidateYear} 年
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden="true">至</span>
          <label>
            結束年度
            <select
              aria-label="分析結束年度"
              value={toYear}
              onChange={(event) =>
                updateQuery({ toYear: Number(event.target.value) })
              }
            >
              {availableYears.map((candidateYear) => (
                <option key={candidateYear} value={candidateYear}>
                  {candidateYear} 年
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {source.length && analysis.length ? (
        <>
          <section className={styles.lawAnalysis} aria-label="命題分類與對應考古題">
              <div className={styles.lawDistribution}>
                <header>
                  <span>{categoryLabel}占比</span>
                  <strong>
                    {year === 'all' ? '跨年度命題分布' : `${year} 年命題分布`}
                  </strong>
                  <p>
                    共 {source.length} 題
                    {subjectId === 'law'
                      ? `、${analysisTotal} 筆法規標註`
                      : ''}
                    ；選擇分類即可查看對應考古題。
                  </p>
                  <input
                    className={styles.categorySearch}
                    type="search"
                    aria-label={`搜尋${categoryLabel}`}
                    placeholder={`搜尋${categoryLabel}`}
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                  />
                </header>
                <div className={styles.lawList} ref={distributionRef} data-chart-motion={distributionEntered || undefined}>
                  {visibleAnalysis.map((item) => (
                    <button
                      type="button"
                      key={item.category}
                      aria-pressed={item.category === selectedCategory}
                      onClick={() => setSelectedCategoryValue(item.category)}
                    >
                      <span>
                        <strong>{item.category}</strong>
                        <small>{item.count} 題</small>
                      </span>
                      <i aria-hidden="true">
                        <span style={{ width: `${item.percentage}%` }} />
                      </i>
                      <b>{item.percentage.toFixed(1)}%</b>
                    </button>
                  ))}
                  {!visibleAnalysis.length ? (
                    <p className={styles.noSearchResults} role="status">
                      找不到符合的分類，請試試其他關鍵字。
                    </p>
                  ) : null}
                </div>
              </div>
              <div className={styles.lawQuestions}>
                {selectedCategory ? (
                  <>
                <header>
                  <span>對應考古題</span>
                  <strong>{selectedCategory}</strong>
                  <p>
                    目前範圍共 {selectedCategoryQuestions.length} 題，點題目可查看詳解；也可以到每日抽題練習用這個類別抽題。
                  </p>
                  <Button
                    variant="primary"
                    onClick={practiceSelectedCategory}
                    disabled={!selectedCategoryQuestions.length}
                  >
                    <IconListCheck size={16} stroke={2} aria-hidden="true" />
                    到每日抽題練習抽題
                  </Button>
                </header>
                <div>
                  {selectedCategoryQuestions.map((question) => (
                    <Link
                      href={examsQuestionHref(question.id)}
                      prefetch={false}
                      key={question.id}
                    >
                      <span>{question.year} 年・{question.questionNumber} 題</span>
                      <strong aria-busy={rowsLoading || undefined}>
                        {question.text || (rowsLoading ? '…' : `${question.topic}題目`)}
                      </strong>
                      <IconArrowRight size={16} stroke={2} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
                  </>
                ) : (
                  <EmptyState title="尚未找到分類" description="請調整搜尋關鍵字。" />
                )}
              </div>
          </section>

          <section
            className={`${styles.chartCard} ${styles.pieOverview}`}
            aria-label="圓形命題占比圖"
          >
            <header>
              <span>比例分布</span>
              <strong>{categoryLabel}占比</strong>
            </header>
            <div className={styles.pieLayout}>
              <div
                className={styles.pie}
                ref={pieRef}
                data-chart-motion={pieEntered || undefined}
                style={{
                  '--pie': `conic-gradient(${pieSegments.parts.join(',')})`,
                } as CSSProperties}
                role="img"
                aria-label={analysis
                  .map(
                    (item) =>
                      `${item.category} ${item.percentage.toFixed(1)}%`,
                  )
                  .join('、')}
              >
                <div className={styles.pieGraphic} key={pieSegments.parts.join(',')} aria-hidden="true" />
                <span>
                  <strong>{analysisTotal}</strong>
                  <span>{subjectId === 'law' ? '筆法規標註' : '題'}</span>
                </span>
              </div>
              <div className={styles.legend}>
                {analysis.map((item, index) => (
                  <div key={item.category}>
                    <i
                      style={{
                        background: chartColors[index % chartColors.length],
                      }}
                      aria-hidden="true"
                    />
                    <span>{item.category}</span>
                    <strong>{item.percentage.toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <DetailedTrendAnalysis
            key={subjectId}
            questions={questions}
            subjectId={subjectId}
            years={trendYears}
            colors={chartColors}
          />

        </>
      ) : (
        <section className={styles.tableCard}>
          <EmptyState title="這個範圍尚無分析資料" description="題庫補齊後，分類題數與占比會自動出現在這裡。" />
        </section>
      )}
    </>
  );
}
