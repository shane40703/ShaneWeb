import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { IconChartPie, IconExternalLink } from '@tabler/icons-react';
import { EmptyState } from '@/components/content/content';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import { subjects, years } from '@/question-bank/catalog';
import { analysisCategoryCatalog } from '@/question-bank/schema';
import {
  getAnalysis,
  getAnalysisCategory,
  getLawAnalysis,
  isSubjectId,
  parseYear,
} from '@/lib/study';
import type { QuestionSummary, SubjectId } from '@/lib/types';
import styles from './analysis-page.module.css';

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
  const subject = subjects.find((candidate) => candidate.id === subjectId) ?? subjects[0];
  const availableYears = years.filter((candidateYear) =>
    questions.some(
      (question) => question.subject === subjectId && question.year === candidateYear,
    ),
  );
  const source = questions.filter(
    (question) =>
      question.subject === subjectId && (year === 'all' || question.year === year),
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
          ? question.relatedLaws?.includes(selectedCategory)
          : getAnalysisCategory(
              question.subject,
              question.topic,
              question.primaryCategory,
            ) === selectedCategory,
      )
    : [];

  function updateQuery(next: { subject?: SubjectId; year?: number | 'all' }) {
    void router.replace(
      {
        pathname: '/analysis',
        query: {
          subject: next.subject ?? subjectId,
          year: String(next.year ?? year),
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  function changeSubject(nextSubject: SubjectId) {
    if (year === 'all') {
      updateQuery({ subject: nextSubject });
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

  return (
    <>
      <QuestionSelector
        heading="選擇分析範圍"
        description={
          subjectId === 'law'
            ? '依題目標註的相關法規統計命題分布；同一題可能對應多筆法規標註。'
            : '依題庫的主要分類統計命題分布；每題只計入一個主要分類。'
        }
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
        summary={
          <>
            已選 <strong>{subject.name} · {year === 'all' ? '跨年度' : `${year} 年`}</strong>
          </>
        }
        action={<span className={styles.scopeCount}>總題數 <strong>{source.length}</strong> 題</span>}
      />

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

          {year === 'all' ? (
            <section className={styles.yearCard}>
              <header><span>跨年度比較</span><strong>各年度收錄題數</strong></header>
              <div className={styles.yearBars}>
                {years.map((candidateYear) => {
                  const count = source.filter((question) => question.year === candidateYear).length;
                  const max = Math.max(...years.map((entryYear) => source.filter((question) => question.year === entryYear).length), 1);
                  return (
                    <div key={candidateYear}>
                      <span>{candidateYear}</span>
                      <i style={{ height: `${Math.max(5, (count / max) * 100)}%` }} />
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

        </>
      ) : (
        <section className={styles.tableCard}>
          <EmptyState icon={IconChartPie} title="這個範圍尚無分析資料" description="題庫補齊後，分類題數與占比會自動出現在這裡。" />
        </section>
      )}
    </>
  );
}
