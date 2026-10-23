import Link from 'next/link';
import { useId } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import type { PracticeOverview } from './practice-overview';
import {
  practiceClozePage,
  practiceMockExamPage,
  practiceQuizPage,
  type PracticeHubPageLink,
} from './practice-pages';
import styles from './practice-hub-page.module.css';

const numberFormat = new Intl.NumberFormat('zh-TW');

function PracticeLink({
  page,
  stat,
  prefetch,
}: {
  page: PracticeHubPageLink;
  stat: string;
  prefetch?: false;
}) {
  const titleId = useId();
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <span className={styles.cardIcon} aria-hidden="true">
        <page.icon size={24} stroke={1.8} />
      </span>
      <div className={styles.cardText}>
        <h2 id={titleId}>
          <Link href={page.href} prefetch={prefetch} className={styles.cardLink}>
            {page.label}
          </Link>
        </h2>
        <p>{page.summary}</p>
        <p className={styles.stat}>{stat}</p>
      </div>
      <IconChevronRight
        className={styles.chevron}
        size={20}
        stroke={2}
        aria-hidden="true"
      />
    </article>
  );
}

/**
 * Words and links only: each practice keeps its own progress and picks it up again when
 * opened, so the hub needs no shortcuts into it.
 */
export function PracticeHubPage({ overview }: { overview: PracticeOverview }) {
  const { quiz, cloze, mockExam } = overview;

  return (
    <div className={styles.hub}>
      <p className={styles.intro}>
        每天練一點：選擇題熟悉考法，克漏字背熟法規數字，模擬考整份試卷驗收實力。
      </p>
      <ul className={styles.links}>
        <li>
          <PracticeLink
            page={practiceQuizPage}
            stat={`${quiz.subjects} 科・${numberFormat.format(quiz.questions)} 題`}
          />
        </li>
        <li>
          {/* The cloze page carries the whole statute bank: fetch it on intent only. */}
          <PracticeLink
            page={practiceClozePage}
            prefetch={false}
            stat={`${cloze.laws} 部法規・${numberFormat.format(cloze.questions)} 題`}
          />
        </li>
        <li>
          <PracticeLink
            page={practiceMockExamPage}
            stat={`${mockExam.subjects} 科・${mockExam.papers} 份試卷`}
          />
        </li>
      </ul>
    </div>
  );
}
