import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { IconArrowsMaximize, IconMinus, IconPlus, IconX, IconZoomIn } from '@tabler/icons-react';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import { clampGalleryView, galleryGesture, GALLERY_FIT_VIEW, GALLERY_MAX_ZOOM, GALLERY_MIN_ZOOM,
  zoomGalleryView, type GalleryPoint, type GalleryView } from './memory-gallery-zoom';
import styles from './memory-gallery-lightbox.module.css';

function GalleryImageViewer({ item }: { item: MemoryGalleryImage }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, GalleryPoint>());
  const viewRef = useRef(GALLERY_FIT_VIEW);
  const [view, setView] = useState(GALLERY_FIT_VIEW);
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const bounds = useCallback(() => viewportRef.current?.getBoundingClientRect() ?? { width: 0, height: 0, left: 0, top: 0 }, []);
  const applyView = useCallback((next: GalleryView) => {
    const bounded = clampGalleryView(next, bounds(), { width: item.width, height: item.height });
    viewRef.current = bounded;
    setView(previous => previous.scale === bounded.scale && previous.x === bounded.x && previous.y === bounded.y ? previous : bounded);
  }, [bounds, item.width, item.height]);
  const zoom = useCallback((scale: number, anchor?: GalleryPoint, destination?: GalleryPoint) => {
    applyView(zoomGalleryView(viewRef.current, scale, bounds(), { width: item.width, height: item.height }, anchor, destination));
  }, [applyView, bounds, item.width, item.height]);
  const point = useCallback((clientX: number, clientY: number): GalleryPoint => {
    const rect = bounds();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, [bounds]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // React's delegated wheel listeners are passive; this local non-passive
    // listener keeps wheel/trackpad pinches inside the viewer, not the page.
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      const delta = Math.max(-1000, Math.min(1000, event.deltaY * unit));
      zoom(viewRef.current.scale * Math.exp(-delta * .002), point(event.clientX, event.clientY));
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    const observer = new ResizeObserver(() => {
      pointers.current.clear();
      applyView(viewRef.current);
    });
    observer.observe(viewport);
    return () => { viewport.removeEventListener('wheel', wheel); observer.disconnect(); };
  }, [applyView, point, zoom]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (pointers.current.size >= 2) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event.clientX, event.clientY));
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    const previous = galleryGesture([...pointers.current.values()]);
    pointers.current.set(event.pointerId, point(event.clientX, event.clientY));
    const next = galleryGesture([...pointers.current.values()]);
    const scale = previous.distance > 0 ? viewRef.current.scale * next.distance / previous.distance : viewRef.current.scale;
    zoom(scale, previous.centre, next.centre);
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const current = viewRef.current;
    if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
    if (event.key === '+' || event.key === '=') zoom(current.scale * 1.25);
    else if (event.key === '-') zoom(current.scale / 1.25);
    else if (event.key === '0') applyView(GALLERY_FIT_VIEW);
    else if (event.key === 'ArrowLeft') applyView({ ...current, x: current.x + 60 });
    else if (event.key === 'ArrowRight') applyView({ ...current, x: current.x - 60 });
    else if (event.key === 'ArrowUp') applyView({ ...current, y: current.y + 60 });
    else if (event.key === 'ArrowDown') applyView({ ...current, y: current.y - 60 });
  }

  return <>
    <header className={styles.heading}>
      <Dialog.Title className={styles.title}>{`放大檢視 ${item.title}`}</Dialog.Title>
      <Dialog.Close className={styles.iconButton} aria-label="關閉放大圖片"><IconX size={22} aria-hidden="true" /></Dialog.Close>
    </header>
    <div className={styles.toolbar} role="group" aria-label="圖片縮放工具">
      <button type="button" className={styles.iconButton} aria-label="縮小圖片" disabled={view.scale <= GALLERY_MIN_ZOOM}
        onClick={() => zoom(viewRef.current.scale / 1.25)}><IconMinus size={20} aria-hidden="true" /></button>
      <input type="range" aria-label="圖片縮放比例" aria-valuetext={`${Math.round(view.scale * 100)}%`}
        min={GALLERY_MIN_ZOOM * 100} max={GALLERY_MAX_ZOOM * 100} step={1} value={Math.round(view.scale * 100)}
        onChange={event => zoom(Number(event.target.value) / 100)} />
      <output aria-label="目前縮放比例">{Math.round(view.scale * 100)}%</output>
      <button type="button" className={styles.iconButton} aria-label="放大圖片" disabled={view.scale >= GALLERY_MAX_ZOOM}
        onClick={() => zoom(viewRef.current.scale * 1.25)}><IconPlus size={20} aria-hidden="true" /></button>
      <button type="button" className={styles.fitButton} onClick={() => applyView(GALLERY_FIT_VIEW)}>
        <IconArrowsMaximize size={18} aria-hidden="true" />符合畫面</button>
    </div>
    <div ref={viewportRef} className={styles.viewport} role="region" aria-label="圖片縮放與拖曳區" tabIndex={0}
      aria-busy={imageStatus === 'loading'} data-zoomed={view.scale > 1 || undefined}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onLostPointerCapture={event => pointers.current.delete(event.pointerId)} onKeyDown={keyboard}
      onDoubleClick={event => viewRef.current.scale > 1 ? applyView(GALLERY_FIT_VIEW) : zoom(2.5, point(event.clientX, event.clientY))}
      onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()} onCopy={event => event.preventDefault()}>
      <div className={styles.image} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <Image src={item.src} alt={item.title} fill unoptimized draggable={false} sizes="100vw"
          onLoad={() => setImageStatus('ready')} onError={() => setImageStatus('error')} />
      </div>
      {imageStatus !== 'ready' ? <p className={styles.imageStatus} role="status">
        {imageStatus === 'error' ? '圖片載入失敗，請關閉後重試。' : '圖片載入中…'}</p> : null}
    </div>
    <footer className={styles.footer}>
      <Dialog.Description>滾輪或雙指縮放，放大後拖曳移動；雙擊切換放大／符合畫面。鍵盤可用 +／−、方向鍵與 0。</Dialog.Description>
      <p>僅供線上檢視，請勿另存或轉載。</p>
    </footer>
  </>;
}

export function MemoryGalleryLightbox({ item, triggerClassName }: { item: MemoryGalleryImage; triggerClassName?: string }) {
  return <Dialog.Root>
    <Dialog.Trigger className={`${styles.trigger} ${triggerClassName ?? ''}`} aria-label={`放大圖片 ${item.title}`}
      onContextMenu={event => event.preventDefault()} onDragStart={event => event.preventDefault()}>
      <span aria-hidden="true"><IconZoomIn size={19} /></span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className={styles.backdrop} />
      <Dialog.Popup className={styles.popup} onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault();
      }}>
        <GalleryImageViewer item={item} />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
