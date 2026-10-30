import Link from 'next/link';
import { useId } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { useTaipeiDate } from '@/features/home/exam-countdown';
import { ActivityHeatmapSection } from './activity-heatmap-panel';
import { personalPages, type PersonalPage } from './personal-pages';
import styles from './personal-hub-page.module.css';

function PersonalLink({ page }: { page: PersonalPage }) {
  const titleId = useId();
  return (
    <article className={styles.row} aria-labelledby={titleId}>
      <h2 id={titleId}>
        <Link href={page.href} className={styles.rowLink}>
          {page.label}
        </Link>
      </h2>
      <p>{page.summary}</p>
      <IconChevronRight
        className={styles.chevron}
        size={20}
        stroke={2}
        aria-hidden="true"
      />
    </article>
  );
}

/** 作答活動在上，下面一列一個個人頁面。 */
export function PersonalHubPage({ today }: { today?: string }) {
  const currentDate = useTaipeiDate();
  return (
    <div className={styles.hub}>
      <ActivityHeatmapSection today={today ?? currentDate} />
      <ul className={styles.links}>
        {personalPages.map((page) => (
          <li key={page.id}>
            <PersonalLink page={page} />
          </li>
        ))}
      </ul>
    </div>
  );
}
