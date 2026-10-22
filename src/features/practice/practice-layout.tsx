import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { practiceHub } from './practice-pages';
import styles from './practice-layout.module.css';

/**
 * Frame for the practice hub's pages: a way back to the hub instead of the resources
 * hub's section switcher. `narrow` follows the law cloze page, which centers itself.
 */
export function PracticeLayout({
  narrow = false,
  children,
}: {
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={narrow ? `${styles.frame} ${styles.narrow}` : styles.frame}>
      <Link href={practiceHub.href} className={styles.back}>
        <IconArrowLeft size={16} stroke={2.2} aria-hidden="true" />
        返回每日練習
      </Link>
      {children}
    </div>
  );
}
