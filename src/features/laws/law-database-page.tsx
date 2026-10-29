import { IconExternalLink, IconScale } from '@tabler/icons-react';
import { EmptyState } from '@/components/content/content';
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
      {laws.length ? (
        <div className={styles.list}>
          <div className={styles.head} aria-hidden="true">
            <span>#</span>
            <span>法規</span>
            <span>占比</span>
            <span>原文</span>
          </div>
          {laws.map((law, index) => {
            const percentage = totalCount
              ? (law.questionCount / totalCount) * 100
              : 0;
            const content = (
              <>
                <span className={styles.rank} aria-hidden="true">
                  {index + 1}
                </span>
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
                    <IconExternalLink size={16} stroke={2} aria-label="開啟全國法規資料庫" />
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
      ) : (
        <div className={styles.list}>
          <EmptyState
            icon={IconScale}
            title="尚無法規資料"
            description="題庫標註法規後，法規清單與出現次數會自動出現在這裡。"
          />
        </div>
      )}
    </section>
  );
}
