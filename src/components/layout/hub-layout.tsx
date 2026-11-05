import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { InPageLink } from '@/components/in-page-link';
import styles from './hub-layout.module.css';

/**
 * Frame for a hub's pages: a way back to the hub above the page. `narrow` follows pages
 * that center themselves, such as the law cloze page.
 *
 * - `hub` null draws no way back (the top of a tree); the page stays at the same position, so
 *   a page that moves between levels keeps its state.
 * - `onFollow` stays on the loaded page for a plain click, as a page that moves between levels
 *   without loading does; a new tab still gets the real address.
 */
export function HubLayout({
  hub,
  narrow = false,
  onFollow,
  children,
}: {
  hub: { href: string; label: string } | null;
  narrow?: boolean;
  onFollow?: () => void;
  children: ReactNode;
}) {
  // 「返回 114 年…」: a label that starts with a number reads apart from 返回.
  const label = hub ? `返回${/^\d/.test(hub.label) ? ' ' : ''}${hub.label}` : '';
  const content = (
    <>
      <IconArrowLeft size={16} stroke={2.2} aria-hidden="true" />
      {label}
    </>
  );
  return (
    <div className={narrow ? `${styles.frame} ${styles.narrow}` : styles.frame}>
      {!hub ? null : onFollow ? (
        <InPageLink href={hub.href} className={styles.back} onFollow={onFollow}>
          {content}
        </InPageLink>
      ) : (
        <Link href={hub.href} className={styles.back}>
          {content}
        </Link>
      )}
      {children}
    </div>
  );
}
