import { IconExternalLink, IconScale } from '@tabler/icons-react';
import { lawSearchUrl, type LawDatabaseEntry } from './law-database';
import styles from './law-database-page.module.css';

export type { LawDatabaseEntry } from './law-database';

export function LawDatabasePage({
  laws,
  showHeader = true,
}: {
  laws: readonly LawDatabaseEntry[];
  /** The resources hub (新版) replaces this hero with its shared page header. */
  showHeader?: boolean;
}) {
  const totalCount = laws.reduce((total, law) => total + law.questionCount, 0);
  return (
    <section
      className={styles.page}
      aria-labelledby={showHeader ? 'law-database-title' : undefined}
      aria-label={showHeader ? undefined : '法規資料庫'}
    >
      {showHeader ? (
        <header className={styles.hero}>
          <span className={styles.icon} aria-hidden="true"><IconScale size={24} stroke={1.9} /></span>
          <div>
            <p>全國法規資料庫</p>
            <h2 id="law-database-title">法規資料庫</h2>
            <span>收錄考題曾出現的 {laws.length} 項法規；點擊後會在新分頁開啟法務部全國法規資料庫搜尋結果。</span>
          </div>
        </header>
      ) : null}
      <div className={styles.list}>
        {laws.map((law) => {
          const percentage = totalCount
            ? (law.questionCount / totalCount) * 100
            : 0;
          const content = (
            <>
              <span className={styles.lawName}>
                <strong>{law.name}</strong>
                <small>出現在 {law.questionCount} 題考題分類</small>
              </span>
              <span className={styles.ratio}>
                <span aria-hidden="true">
                  <i style={{ width: `${percentage}%` }} />
                </span>
                <strong>{percentage.toFixed(1)}%</strong>
              </span>
              <span className={styles.destination}>
                {law.linkable ? (
                  <IconExternalLink size={18} stroke={2} aria-label="開啟全國法規資料庫" />
                ) : (
                  <small className={styles.unavailable}>無法規連結</small>
                )}
              </span>
            </>
          );
          return law.linkable ? (
            <a
              key={law.name}
              className={styles.law}
              href={lawSearchUrl(law.name)}
              target="_blank"
              rel="noreferrer"
            >
              {content}
            </a>
          ) : (
            <div key={law.name} className={styles.law}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
