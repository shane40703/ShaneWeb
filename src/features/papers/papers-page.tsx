import Link from 'next/link';
import { useRouter } from 'next/router';
import { PageHeader } from '@/components/content/content';
import { Button, SimpleSelect } from '@/components/ui/ui';
import { questions, subjects, years } from '@/data/questions';
import { isSubjectId } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import styles from './papers-page.module.css';

const subjectOptions = subjects.map((subject) => ({
  value: subject.id,
  label: subject.name,
}));

export function PapersPage() {
  const router = useRouter();
  const value = Array.isArray(router.query.subject)
    ? router.query.subject[0]
    : router.query.subject;
  const subjectId: SubjectId = router.isReady && isSubjectId(value) ? value : 'law';

  function changeSubject(value: SubjectId) {
    void router.replace(
      { pathname: '/papers', query: { subject: value } },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  const subject = subjects.find((candidate) => candidate.id === subjectId) ?? subjects[0];

  return (
    <>
      <PageHeader
        eyebrow="PAPERS / 102—114"
        title="歷屆試題"
        description="選擇科目與年度，直接開始作答。"
      />
      <section className={styles.paperPanel}>
        <div className={styles.subjectPicker}>
          <SimpleSelect
            label="科目"
            value={subjectId}
            options={subjectOptions}
            onValueChange={changeSubject}
          />
          <div>
            <span className={styles.subjectMark}>{subject.symbol}</span>
            <strong>{subject.name}</strong>
          </div>
        </div>
        <div className={styles.yearList}>
          {years.map((year) => {
            const count = questions.filter(
              (question) => question.subject === subjectId && question.year === year,
            ).length;
            return (
              <article className={styles.yearRow} key={year}>
                <div>
                  <strong>民國 {year} 年</strong>
                  <span>{count ? `目前收錄 ${count} 題` : '題庫資料待補'}</span>
                </div>
                <Button
                  variant="primary"
                  render={<Link href={`/quiz?subject=${subjectId}&year=${year}`} />}
                >
                  開始作答 <span aria-hidden="true">→</span>
                </Button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
