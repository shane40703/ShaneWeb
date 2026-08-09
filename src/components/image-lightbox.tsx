import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconZoomIn } from '@tabler/icons-react';
import styles from './image-lightbox.module.css';

export function ImageLightbox({
  src,
  alt,
  triggerClassName,
  triggerLabel,
}: {
  src: string;
  alt: string;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
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
                <div className={styles.image}>
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    unoptimized={src.startsWith('data:')}
                    sizes="94vw"
                    priority
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
