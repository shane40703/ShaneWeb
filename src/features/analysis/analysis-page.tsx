import type { CSSProperties } from 'react';
import { useRouter } from 'next/router';
import { IconChartPie } from '@tabler/icons-react';
import { EmptyState, PageHeader } from '@/components/content/content';
import { SimpleSelect } from '@/components/ui/ui';
import { questions, subjects, years } from '@/data/questions';
import { getAnalysis, isSubjectId, parseYear } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import styles from './analysis-page.module.css';

const colors = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#dc4c64', '#64748b'];
const subjectOptions = subjects.map((subject) => ({ value: subject.id, label: subject.name }));
const yearOptions = [
  { value: 'all', label: '跨年度比較' },
  ...years.map((year) => ({ value: String(year), label: `${year} 年` })),
];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AnalysisPage() {
  const router = useRouter();
  const querySubject = valueOf(router.query.subject);
  const subjectId: SubjectId = isSubjectId(querySubject) ? querySubject : 'law';
  const queryYear = valueOf(router.query.year);
  const parsedYear = parseYear(queryYear);
  const year: number | 'all' = queryYear === 'all' ? 'all' : parsedYear ?? 114;
  const subject = subjects.find((candidate) => candidate.id === subjectId) ?? subjects[0];
  const source = questions.filter(
    (question) =>
      question.subject === subjectId && (year === 'all' || question.year === year),
  );
  const analysis = getAnalysis(source);

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

  const cursor = analysis.reduce(
    (result, item, index) => {
      const start = result.total;
      const end = start + item.percentage;
      result.parts.push(`${colors[index % colors.length]} ${start}% ${end}%`);
      result.total = end;
      return result;
    },
    { total: 0, parts: [] as string[] },
  );

  return (
    <>
      <PageHeader
        eyebrow="EXAM CONTENT ANALYSIS"
        title="考題分析"
        description="依題庫的主要分類統計命題分布；每題只計入一個主要分類。"
      />
      <section className={styles.filters} aria-label="分析條件">
        <SimpleSelect
          label="科目"
          value={subjectId}
          options={subjectOptions}
          onValueChange={(value) => updateQuery({ subject: value })}
        />
        <SimpleSelect
          label="年份"
          value={String(year)}
          options={yearOptions}
          onValueChange={(value) => updateQuery({ year: value === 'all' ? 'all' : Number(value) })}
        />
        <div className={styles.total}>
          <span>分析範圍</span>
          <strong>{year === 'all' ? '跨年度' : `${year} 年`}・{subject.name}</strong>
          <small>總題數 {source.length} 題</small>
        </div>
      </section>

      {analysis.length ? (
        <>
          <div className={styles.chartGrid}>
            <section className={styles.chartCard}>
              <header><span>比例分布</span><strong>主要分類占比</strong></header>
              <div className={styles.pieLayout}>
                <div
                  className={styles.pie}
                  style={{ '--pie': `conic-gradient(${cursor.parts.join(',')})` } as CSSProperties}
                  role="img"
                  aria-label={analysis.map((item) => `${item.category} ${item.percentage.toFixed(1)}%`).join('、')}
                >
                  <span><strong>{source.length}</strong>題</span>
                </div>
                <div className={styles.legend}>
                  {analysis.map((item, index) => (
                    <div key={item.category}>
                      <i style={{ background: colors[index % colors.length] }} />
                      <span>{item.category}</span>
                      <strong>{item.percentage.toFixed(1)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className={styles.chartCard}>
              <header><span>題數比較</span><strong>各分類出題數</strong></header>
              <div className={styles.bars}>
                {analysis.map((item, index) => (
                  <div className={styles.barRow} key={item.category}>
                    <span>{item.category}</span>
                    <div><i style={{ width: `${item.percentage}%`, background: colors[index % colors.length] }} /></div>
                    <strong>{item.count} 題</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

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

          <section className={styles.tableCard}>
            <table>
              <caption>{year === 'all' ? '跨年度' : `${year} 年`}分類統計</caption>
              <thead><tr><th>主要分類</th><th>題數</th><th>占比</th></tr></thead>
              <tbody>
                {analysis.map((item) => (
                  <tr key={item.category}><th>{item.category}</th><td>{item.count} 題</td><td>{item.percentage.toFixed(1)}%</td></tr>
                ))}
              </tbody>
              <tfoot><tr><th>合計</th><td>{source.length} 題</td><td>100%</td></tr></tfoot>
            </table>
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
