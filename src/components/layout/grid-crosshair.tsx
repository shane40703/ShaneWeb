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
    let lastMouse: { x: number; y: number } | null = null;
    let scrollFrame: number | null = null;

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

    function update() {
      if (!lastMouse || !window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches) {
        hide();
        return;
      }
      const { x, y } = lastMouse;
      const target = document.elementFromPoint(x, y);
      if (!isPaper(target)) {
        hide();
        return;
      }
      if (cursorTarget !== target) {
        cursorTarget?.removeAttribute('data-grid-cursor');
        cursorTarget = target;
        target.setAttribute('data-grid-cursor', '');
      }

      // The paper scrolls with the document, so measure from the body's actual origin.
      const step = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--paper-grid-step')) || 16;
      const origin = document.body.getBoundingClientRect();
      const snapX = origin.left + Math.round((x - origin.left) / step) * step;
      const snapY = origin.top + Math.round((y - origin.top) / step) * step;
      const snap = Math.abs(snapX - x) <= 4 && Math.abs(snapY - y) <= 4 && isPaper(document.elementFromPoint(snapX, snapY));
      marker!.style.left = `${snap ? snapX : x}px`;
      marker!.style.top = `${snap ? snapY : y}px`;
      marker!.toggleAttribute('data-snapped', snap);
      marker!.hidden = false;
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || event.buttons) {
        lastMouse = null;
        hide();
        return;
      }
      lastMouse = { x: event.clientX, y: event.clientY };
      update();
    }

    function clear() {
      lastMouse = null;
      hide();
    }

    function scroll() {
      if (scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        update();
      });
    }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', move);
    document.addEventListener('pointerdown', clear);
    document.addEventListener('pointerleave', clear);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('blur', clear);
    return () => {
      clear();
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', move);
      document.removeEventListener('pointerdown', clear);
      document.removeEventListener('pointerleave', clear);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('blur', clear);
    };
  }, [workspace]);

  return <div ref={crosshair} className={styles.crosshair} data-testid="grid-crosshair" aria-hidden="true" hidden><span /></div>;
}
