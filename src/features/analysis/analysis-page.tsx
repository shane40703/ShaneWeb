import Link from 'next/link';
import { useRouter } from 'next/router';
import { type CSSProperties, useState } from 'react';
import {
  IconChartPie,
  IconExternalLink,
  IconPlayerPlay,
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
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from './analysis-page.module.css';

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AnalysisPage({ questions }: { questions: QuestionSummary[] }) {
  const router = useRouter();
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
  );
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
  const selectedCategory = analysis.some(
    (item) => item.category === selectedCategoryValue,
  )
    ? selectedCategoryValue
    : analysis[0]?.category;
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
        pathname: '/analysis',
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

  function startSelectedCategoryQuiz() {
    const firstQuestion = selectedCategoryQuestions[0];
    if (!firstQuestion) return;
    void router.push({
      pathname: firstQuestion.path,
      query: {
        mode: 'random',
        questions: selectedCategoryQuestions
          .map((question) => question.id)
          .join(','),
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
          {selectedCategory ? (
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
                </header>
                <div className={styles.lawList}>
                  {analysis.map((item) => (
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
                </div>
              </div>
              <div className={styles.lawQuestions}>
                <header>
                  <span>對應考古題</span>
                  <strong>{selectedCategory}</strong>
                  <p>
                    目前範圍共 {selectedCategoryQuestions.length} 題，點選即可前往作答。
                  </p>
                  <Button
                    variant="primary"
                    onClick={startSelectedCategoryQuiz}
                    disabled={!selectedCategoryQuestions.length}
                  >
                    <IconPlayerPlay size={16} stroke={2} aria-hidden="true" />
                    作答全部 {selectedCategoryQuestions.length} 題
                  </Button>
                </header>
                <div>
                  {selectedCategoryQuestions.map((question) => (
                    <Link href={`${question.path}?mode=single`} key={question.id}>
                      <span>{question.year} 年・{question.questionNumber} 題</span>
                      <strong>{question.text || `${question.topic}題目`}</strong>
                      <IconExternalLink size={16} stroke={2} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

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

        </>
      ) : (
        <section className={styles.tableCard}>
          <EmptyState icon={IconChartPie} title="這個範圍尚無分析資料" description="題庫補齊後，分類題數與占比會自動出現在這裡。" />
        </section>
      )}
    </>
  );
}
