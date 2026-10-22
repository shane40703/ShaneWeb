import Image from 'next/image';
import Link from 'next/link';
import { useId, type ReactNode, type SyntheticEvent } from 'react';
import { IconArrowRight, IconChevronRight, IconExternalLink } from '@tabler/icons-react';
import { SubjectIconBadge } from '@/components/subject-icon';
import { lawSearchUrl } from '@/features/laws/law-database';
import { memoryGalleryCardId, memoryGalleryCategoryLabel } from '@/lib/memory-gallery';
import { getSubject } from '@/question-bank/catalog';
import { ResourceLayout } from './resource-layout';
import { resourceGalleryHref, resourcePages, type ResourcePage } from './resource-pages';
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
  const { questions, latestYears, gallery, laws } = overview;
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
              <p className={styles.quickLabel}>直接看各科最新年度</p>
              <div className={styles.subjectLinks}>
                {latestYears.map(({ subject, year }) => {
                  const content = (
                    <>
                      <SubjectIconBadge subject={subject} />
                      <strong>{getSubject(subject)?.name}</strong>{' '}
                      <small>{year ? `${year} 年` : '準備中'}</small>
                    </>
                  );
                  return year ? (
                    // Each subject's link is a separate copy of the whole bank's page data,
                    // so it is fetched on hover or touch rather than whenever it scrolls in.
                    <Link
                      key={subject}
                      href={{ pathname: analysisPage.href, query: { subject, year } }}
                      prefetch={false}
                      className={styles.subjectLink}
                    >
                      {content} <span className={styles.visuallyHidden}>考題分析</span>
                      <IconChevronRight size={16} stroke={2} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span
                      key={subject}
                      className={`${styles.subjectLink} ${styles.pending}`}
                    >
                      {content}
                    </span>
                  );
                })}
              </div>
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
                      <Link
                        key={item.id}
                        href={`${resourceGalleryHref(item.category)}#${memoryGalleryCardId(item.id)}`}
                        className={styles.thumbnail}
                        title={item.title}
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
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.quickEmpty}>
                  管理者上傳整理圖後，最新的圖片會顯示在這裡。
                </p>
              )}
              <div className={styles.categoryLinks}>
                {gallery.categories.map(({ id, count }) =>
                  count ? (
                    <Link
                      key={id}
                      href={resourceGalleryHref(id)}
                      className={styles.categoryLink}
                    >
                      <strong>{memoryGalleryCategoryLabel(id)}</strong>{' '}
                      <span>{count} 張</span>
                    </Link>
                  ) : (
                    <span key={id} className={styles.categoryPending}>
                      <strong>{memoryGalleryCategoryLabel(id)}</strong>{' '}
                      <span>準備中</span>
                    </span>
                  ),
                )}
              </div>
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
                        <a
                          href={lawSearchUrl(law.name)}
                          target="_blank"
                          rel="noreferrer"
                          title={law.name}
                        >
                          <span className={styles.lawRank} aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className={styles.lawName}>{law.name}</span>{' '}
                          <span className={styles.lawCount}>{law.questionCount} 題</span>
                          <IconExternalLink size={15} stroke={2} aria-hidden="true" />
                          <span className={styles.visuallyHidden}>
                            （在新分頁開啟全國法規資料庫）
                          </span>
                        </a>
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
