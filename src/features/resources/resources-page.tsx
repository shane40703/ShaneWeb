import Image from 'next/image';
import Link from 'next/link';
import { useId, type ReactNode, type SyntheticEvent } from 'react';
import { IconArrowRight } from '@tabler/icons-react';
import { ResourceLayout } from './resource-layout';
import { resourcePages, type ResourcePage } from './resource-pages';
import type { ResourcesOverview } from './resources-overview';
import styles from './resources-page.module.css';

const [analysisPage, galleryPage, lawsPage] = resourcePages;
const numberFormat = new Intl.NumberFormat('zh-TW');

// The gallery is view-only, so previews block the ordinary save gestures too.
function preventImageSaving(event: SyntheticEvent) {
  event.preventDefault();
}

function ResourceCard({
  step,
  page,
  stat,
  children,
}: {
  step: number;
  page: ResourcePage;
  stat: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <span className={styles.step} aria-hidden="true">
        {String(step).padStart(2, '0')}
      </span>
      <header className={styles.cardHeader}>
        <span className={styles.cardIcon} aria-hidden="true">
          <page.icon size={24} stroke={1.8} />
        </span>
        <h2 id={titleId}>
          <Link href={page.href} className={styles.cardLink}>
            {page.label}
          </Link>
        </h2>
        <p>{page.summary}</p>
      </header>
      <div className={styles.cardBody}>{children}</div>
      <footer className={styles.cardFooter}>
        <span>{stat}</span>
        <span className={styles.cardAction} aria-hidden="true">
          進入{page.label}
          <IconArrowRight size={16} stroke={2.2} />
        </span>
      </footer>
    </article>
  );
}

export function ResourcesPage({ overview }: { overview: ResourcesOverview }) {
  const { questions, gallery, laws } = overview;
  const yearRange =
    questions.firstYear === questions.lastYear
      ? `${questions.firstYear}`
      : `${questions.firstYear}–${questions.lastYear}`;

  return (
    <ResourceLayout current="overview">
      <div className={styles.hub}>
        <header className={styles.intro}>
          <p className={styles.introText}>
            從歷屆考題整理出的讀書資料：先看哪裡最常考，再用整理圖記重點，最後查法規原文。
          </p>
          {questions.total ? (
            <p className={styles.scope}>
              <span>
                <strong>{questions.subjectCount}</strong> 科
              </span>{' '}
              <span>
                <strong>{yearRange}</strong> 年
              </span>{' '}
              <span>
                <strong>{numberFormat.format(questions.total)}</strong> 題
              </span>
            </p>
          ) : null}
        </header>

        <ol className={styles.cards}>
          <li>
            <ResourceCard
              step={1}
              page={analysisPage}
              stat={
                questions.total
                  ? `${questions.subjectCount} 科・${yearRange} 年`
                  : '題庫準備中'
              }
            >
              <p className={styles.quickText}>{analysisPage.detail}</p>
            </ResourceCard>
          </li>

          <li>
            <ResourceCard
              step={2}
              page={galleryPage}
              stat={gallery.total ? `共 ${gallery.total} 張整理圖` : '整理圖準備中'}
            >
              {gallery.latest.length ? (
                <>
                  <p className={styles.quickLabel}>最新上架</p>
                  <div className={styles.thumbnails}>
                    {gallery.latest.map((item) => (
                      <span
                        key={item.id}
                        className={styles.thumbnail}
                        onContextMenu={preventImageSaving}
                        onDragStart={preventImageSaving}
                      >
                        <Image
                          src={item.thumbnailSrc}
                          alt={item.title}
                          width={item.width}
                          height={item.height}
                          unoptimized
                          draggable={false}
                        />
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.quickEmpty}>
                  管理者上傳整理圖後，最新的圖片會顯示在這裡。
                </p>
              )}
            </ResourceCard>
          </li>

          <li>
            <ResourceCard
              step={3}
              page={lawsPage}
              stat={laws.total ? `收錄 ${laws.total} 項法規` : '法規準備中'}
            >
              {laws.top.length ? (
                <>
                  <p className={styles.quickLabel}>最常考的法規</p>
                  <ol className={styles.lawList}>
                    {laws.top.map((law, index) => (
                      <li key={law.name}>
                        <span className={styles.lawRank} aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className={styles.lawName}>{law.name}</span>{' '}
                        <span className={styles.lawCount}>{law.questionCount} 題</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className={styles.quickEmpty}>
                  題庫標註法規後，最常考的法規會列在這裡。
                </p>
              )}
            </ResourceCard>
          </li>
        </ol>
      </div>
    </ResourceLayout>
  );
}
