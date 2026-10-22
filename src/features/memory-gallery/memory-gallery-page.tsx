import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { IconPhoto, IconSearch, IconShieldLock } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import {
  MEMORY_GALLERY_CATEGORIES, filterMemoryGalleryImages, memoryGalleryCardId, memoryGalleryCategoryLabel,
  type MemoryGalleryCategory, type MemoryGalleryImage,
} from '@/lib/memory-gallery';
import styles from './memory-gallery-page.module.css';
import { MemoryGalleryLightbox } from './memory-gallery-lightbox';

/** Uploading only works on a local dev server, so the public site hides this dead end. */
export function MemoryGalleryAdminLink() {
  if (process.env.NODE_ENV === 'production') return null;
  return <Button role="link" render={<Link href="/admin/memory-gallery" />}><IconShieldLock size={17} aria-hidden="true" />管理者上傳</Button>;
}

export function MemoryGalleryPage({ items, showHeader = true, category: pageCategory, categoryHref }: {
  items: MemoryGalleryImage[];
  /** The resources hub (新版) replaces this heading with its shared page header. */
  showHeader?: boolean;
  /** With categoryHref each subject is its own prerendered page, named by category. */
  category?: MemoryGalleryCategory;
  categoryHref?: (category: MemoryGalleryCategory) => string;
}) {
  const [selectedCategory, setCategory] = useState<MemoryGalleryCategory>('law');
  const category = categoryHref ? pageCategory ?? 'law' : selectedCategory;
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterMemoryGalleryImages(items, category, search), [items, category, search]);
  const published = items.filter(item => !item.archivedAt);
  const hasSearch = search.trim().length > 0;
  const categoryLabel = memoryGalleryCategoryLabel(category);
  // Without the page heading, titles move up a level so the outline does not skip h2.
  const TitleTag = showHeader ? 'h3' : 'h2';
  return <section className={styles.page} aria-label="速記圖庫">
    {showHeader ? <header className={styles.heading}>
      <div><span className={styles.eyebrow}>VISUAL NOTES</span><h2><IconPhoto size={27} aria-hidden="true" />速記圖庫</h2>
        <p>依科目複習法規、環控、構造與結構。點選圖片可自由縮放、拖曳閱讀；僅供線上檢視。</p></div>
      <MemoryGalleryAdminLink />
    </header> : null}
    <section className={styles.filters} aria-label="篩選速記圖片">
      <div className={styles.categories} role="group" aria-label="圖片分類">
        {MEMORY_GALLERY_CATEGORIES.map(item => {
          const label = <>{item.label}<span>{published.filter(image => image.category === item.id).length}</span></>;
          return categoryHref
            ? <Link key={item.id} href={categoryHref(item.id)} scroll={false} aria-current={category === item.id ? 'page' : undefined}>{label}</Link>
            : <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{label}</button>;
        })}
      </div>
      <label className={styles.search}><IconSearch size={18} aria-hidden="true" />
        <input type="search" aria-label="搜尋圖片標題或說明" placeholder="搜尋此科目的圖片標題或說明" value={search} onChange={event => setSearch(event.target.value)} />
      </label>
    </section>
    <p className={styles.count} role="status">{visible.length} 張圖片</p>
    {visible.length ? <div className={styles.grid}>
      {visible.map(item => <article key={item.id} id={memoryGalleryCardId(item.id)} className={styles.card}>
        <div className={styles.picture} onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()}>
          <Image src={item.src} alt={item.title} width={item.width} height={item.height} unoptimized loading="lazy" draggable={false} />
          <MemoryGalleryLightbox item={item} triggerClassName={styles.zoom} />
        </div>
        <div className={styles.caption}><span className={styles.badge}>{memoryGalleryCategoryLabel(item.category)}</span>
          <TitleTag>{item.title}</TitleTag>{item.description ? <p>{item.description}</p> : null}
        </div>
      </article>)}
    </div> : <div className={styles.empty}><IconPhoto size={40} stroke={1.4} aria-hidden="true" />
      <TitleTag>{!published.length ? '速記圖片準備中' : hasSearch ? '找不到符合條件的圖片' : `${categoryLabel}圖片準備中`}</TitleTag>
      <p>{!published.length ? '管理者上傳整理圖片後，就會在這裡公開顯示。' : hasSearch ? '試試其他關鍵字，或切換科目瀏覽。' : `管理者尚未上傳${categoryLabel}圖片，可先切換其他科目瀏覽。`}</p>
      {hasSearch ? <Button onClick={() => setSearch('')}>清除搜尋</Button> : null}
    </div>}
  </section>;
}
