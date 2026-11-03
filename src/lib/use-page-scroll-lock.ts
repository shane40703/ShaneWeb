import { useEffect } from 'react';

const LOCK_ATTRIBUTE = 'data-page-scroll-locked';
let holders = 0;

/**
 * Keeps the page still behind an overlay that Base UI does not manage. A stylesheet rule does the
 * locking instead of `body.style.overflow`, which Base UI's drawer writes too, on a timer after it
 * closes: a copy saved during that gap and put back later would be a lock nobody owns.
 */
export function usePageScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    holders += 1;
    document.documentElement.setAttribute(LOCK_ATTRIBUTE, '');
    return () => {
      holders -= 1;
      if (!holders) document.documentElement.removeAttribute(LOCK_ATTRIBUTE);
    };
  }, [active]);
}
