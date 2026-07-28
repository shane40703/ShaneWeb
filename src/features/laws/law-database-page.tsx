import { IconExternalLink, IconScale } from '@tabler/icons-react';
import styles from './law-database-page.module.css';

export interface LawDatabaseEntry {
  name: string;
  questionCount: number;
  linkable: boolean;
}

const searchUrl = 'https://law.moj.gov.tw/Law/LawSearchResult.aspx?ty=ONEBAR&kw=';

export function LawDatabasePage({ laws }: { laws: readonly LawDatabaseEntry[] }) {
  return (
    <section className={styles.page} aria-labelledby="law-database-title">
      <header className={styles.hero}>
        <span className={styles.icon} aria-hidden="true"><IconScale size={24} stroke={1.9} /></span>
        <div>
          <p>全國法規資料庫</p>
          <h2 id="law-database-title">法規資料庫</h2>
          <span>收錄考題曾出現的 {laws.length} 項法規；點擊後會在新分頁開啟法務部全國法規資料庫搜尋結果。</span>
        </div>
      </header>
      <div className={styles.list}>
        {laws.map((law) => {
          const content = (
            <>
              <span><strong>{law.name}</strong><small>出現在 {law.questionCount} 題考題分類</small></span>
              {law.linkable ? (
                <IconExternalLink size={18} stroke={2} aria-label="開啟全國法規資料庫" />
              ) : (
                <small className={styles.unavailable}>無法規連結</small>
              )}
            </>
          );
          return law.linkable ? (
            <a
              key={law.name}
              className={styles.law}
              href={`${searchUrl}${encodeURIComponent(law.name)}`}
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
