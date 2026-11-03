import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconZoomIn } from '@tabler/icons-react';
import { usePageScrollLock } from '@/lib/use-page-scroll-lock';
import styles from './image-lightbox.module.css';

export function ImageLightbox({
  src,
  alt,
  triggerClassName,
  triggerLabel,
  protect = false,
}: {
  src: string;
  alt: string;
  triggerClassName?: string;
  triggerLabel?: string;
  protect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  usePageScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      // The close button goes with the dialog; without this, focus falls to the page.
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${triggerClassName ?? ''}`.trim()}
        aria-label={triggerLabel ?? `放大圖片 ${alt}`}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">
          <IconZoomIn size={19} stroke={2} />
        </span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={styles.lightbox}
              role="dialog"
              aria-modal="true"
              aria-label={`放大檢視 ${alt}`}
            >
              <button
                type="button"
                className={styles.backdrop}
                aria-label="關閉放大圖片"
                onClick={() => setOpen(false)}
              />
              <div className={styles.content}>
                <button
                  type="button"
                  className={styles.close}
                  aria-label="關閉放大圖片"
                  onClick={() => setOpen(false)}
                  autoFocus
                >
                  <IconX size={22} stroke={2} aria-hidden="true" />
                </button>
                <div className={styles.image} data-protected={protect || undefined}
                  onContextMenu={protect ? event => event.preventDefault() : undefined}
                  onDragStart={protect ? event => event.preventDefault() : undefined}>
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    unoptimized={src.startsWith('data:')}
                    sizes="94vw"
                    priority
                    draggable={!protect}
                  />
                </div>
                <span>{alt}</span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
