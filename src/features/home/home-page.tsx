import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { SubjectIconBadge } from '@/components/subject-icon';
import { subjects } from '@/question-bank/catalog';
import styles from './home-page.module.css';

export function HomePage() {
  return (
    <section className={styles.home} aria-label="選擇練習科目">
      <div className={styles.subjectGrid}>
        {subjects.map((subject, index) => (
          <Link
            key={subject.id}
            href={`/papers?subject=${subject.id}`}
            className={styles.subjectCard}
            data-subject={subject.id}
          >
            <span className={styles.cardNumber}>0{index + 1}</span>
            <SubjectIconBadge
              subject={subject.id}
              size="large"
              className={styles.subjectIcon}
            />
            <h2>{subject.name}</h2>
            <span className={styles.cardAction}>
              選擇年份 <IconArrowRight size={17} stroke={2} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
