import Link from 'next/link';
import { useRouter } from 'next/router';
import { IconArrowRight } from '@tabler/icons-react';
import { PageHeader } from '@/components/content/content';
import { SubjectIcon } from '@/components/subject-icon';
import { Button } from '@/components/ui/ui';
import { questions, subjects, years } from '@/data/questions';
import { isSubjectId } from '@/lib/study';
import type { SubjectId } from '@/lib/types';
import styles from './papers-page.module.css';

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

  return (
    <>
      <PageHeader
        eyebrow="PAPERS / 102—114"
        title="歷屆試題"
        description="選擇科目與年度，直接開始作答。"
      />
      <section className={styles.paperPanel}>
        <fieldset className={styles.subjectPicker}>
          <legend>科目</legend>
          <div className={styles.subjectGrid}>
            {subjects.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={styles.subjectButton}
                data-subject={item.id}
                aria-pressed={item.id === subjectId}
                onClick={() => changeSubject(item.id)}
              >
                <span className={styles.subjectNumber}>0{index + 1}</span>
                <span className={styles.subjectButtonIcon} aria-hidden="true">
                  <SubjectIcon subject={item.id} size={27} stroke={1.8} />
                </span>
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.yearList}>
          {years.map((year) => {
            const count = questions.filter(
              (question) => question.subject === subjectId && question.year === year,
            ).length;
            return (
              <article className={styles.yearRow} key={year}>
                <div>
                  <strong>{year} 年</strong>
                  <span>{count ? `目前收錄 ${count} 題` : '題庫資料待補'}</span>
                </div>
                <Button
                  variant="primary"
                  render={<Link href={`/quiz?subject=${subjectId}&year=${year}`} />}
                >
                  開始作答 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
                </Button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
