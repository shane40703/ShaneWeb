import Link from 'next/link';
import type { ReactNode } from 'react';
import { resourcePages, resourcesHub, type ResourcePageId } from './resource-pages';
import styles from './resource-layout.module.css';

const sectionLinks = [
  {
    id: 'overview',
    href: resourcesHub.href,
    label: resourcesHub.shortLabel,
    icon: resourcesHub.icon,
  },
  ...resourcePages,
] as const;

/** Header shared by the resources hub and its pages: section switcher, actions and lead. */
export function ResourceLayout({
  current,
  facts,
  actions,
  children,
}: {
  current: ResourcePageId | 'overview';
  /** Live figures read before the page's own detail sentence, e.g. how many laws exist. */
  facts?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const page = resourcePages.find((item) => item.id === current);
  return (
    <>
      <div className={styles.header}>
        <div className={styles.bar}>
          <nav className={styles.sectionNav} aria-label="統計分析頁面">
            {sectionLinks.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.id === current ? 'page' : undefined}
              >
                <item.icon size={16} stroke={2} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
        {page ? (
          <p className={styles.lead}>
            <strong>{page.summary}。</strong>
            {facts}
            {page.detail}
          </p>
        ) : null}
      </div>
      {children}
    </>
  );
}
