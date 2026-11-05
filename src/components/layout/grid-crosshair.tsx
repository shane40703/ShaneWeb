import { useEffect, useRef, type RefObject } from 'react';
import styles from './grid-crosshair.module.css';

/** A drafting cursor only over exposed paper, never over controls or content. */
export function GridCrosshair({ workspace }: { workspace: RefObject<HTMLDivElement | null> }) {
  const crosshair = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = workspace.current;
    const marker = crosshair.current;
    if (!area || !marker) return;
    let cursorTarget: HTMLElement | null = null;

    function hide() {
      marker!.hidden = true;
      cursorTarget?.removeAttribute('data-grid-cursor');
      cursorTarget = null;
    }

    function isPaper(target: Element | null): target is HTMLElement {
      if (!(target instanceof HTMLElement) || !area!.contains(target)) return false;
      // Only layout containers are eligible; text, controls, images and SVGs retain their cursor.
      if (!['DIV', 'MAIN', 'SECTION', 'ARTICLE'].includes(target.tagName)) return false;
      if (Array.from(target.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return false;
      for (let element: HTMLElement | null = target; element && element !== area; element = element.parentElement) {
        if (element.matches('a, button, input, textarea, select, [role], [contenteditable]')) return false;
        const style = getComputedStyle(element);
        if (style.backgroundImage !== 'none' || (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent')) return false;
      }
      return true;
    }

    function move(event: PointerEvent) {
      if (!window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches || event.pointerType !== 'mouse' || event.buttons || !isPaper(event.target as Element)) {
        hide();
        return;
      }
      const target = event.target as HTMLElement;
      if (cursorTarget !== target) {
        cursorTarget?.removeAttribute('data-grid-cursor');
        cursorTarget = target;
        target.setAttribute('data-grid-cursor', '');
      }

      // The paper scrolls with the document, so measure from the body's actual origin.
      const step = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--paper-grid-step')) || 16;
      const origin = document.body.getBoundingClientRect();
      const snapX = origin.left + Math.round((event.clientX - origin.left) / step) * step;
      const snapY = origin.top + Math.round((event.clientY - origin.top) / step) * step;
      const snap = Math.abs(snapX - event.clientX) <= 4 && Math.abs(snapY - event.clientY) <= 4 && isPaper(document.elementFromPoint(snapX, snapY));
      marker!.style.left = `${snap ? snapX : event.clientX}px`;
      marker!.style.top = `${snap ? snapY : event.clientY}px`;
      marker!.toggleAttribute('data-snapped', snap);
      marker!.hidden = false;
    }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('pointerleave', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('pointerleave', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, [workspace]);

  return <div ref={crosshair} className={styles.crosshair} data-testid="grid-crosshair" aria-hidden="true" hidden><span /></div>;
}
