import Link from 'next/link';
import { subjects } from '@/data/questions';
import styles from './home-page.module.css';

export function HomePage() {
  return (
    <section className={styles.home} aria-labelledby="home-title">
      <header className={styles.intro}>
        <span>ARCHITECT EXAM PRACTICE</span>
        <h1 id="home-title">選擇練習科目</h1>
      </header>
      <div className={styles.subjectGrid}>
        {subjects.map((subject, index) => (
          <Link
            key={subject.id}
            href={`/papers?subject=${subject.id}`}
            className={styles.subjectCard}
            data-subject={subject.id}
          >
            <span className={styles.cardNumber}>0{index + 1}</span>
            <span className={styles.subjectIcon} aria-hidden="true">
              {subject.symbol}
            </span>
            <h2>{subject.name}</h2>
            <span className={styles.cardAction}>
              選擇年份 <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
