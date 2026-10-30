import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import styles from './hub-layout.module.css';

/**
 * Frame for a hub's pages: a way back to the hub above the page. `narrow` follows pages
 * that center themselves, such as the law cloze page.
 */
export function HubLayout({
  hub,
  narrow = false,
  children,
}: {
  hub: { href: string; label: string };
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={narrow ? `${styles.frame} ${styles.narrow}` : styles.frame}>
      <Link href={hub.href} className={styles.back}>
        <IconArrowLeft size={16} stroke={2.2} aria-hidden="true" />
        返回{hub.label}
      </Link>
      {children}
    </div>
  );
}
