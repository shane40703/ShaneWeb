import { useRouter, type NextRouter } from 'next/router';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { examsQuery, type ExamsTab } from '@/lib/question-path';
import { useRememberExamsPlace } from './exams-last-place';

/** What Next keeps in `history.state` for an entry it made; only the parts read here. */
interface NextHistoryState {
  __N?: boolean;
  key?: string;
  options?: { shallow?: boolean; scroll?: boolean };
}

function entryState() {
  return window.history.state as NextHistoryState | null;
}

/** How far down each entry of 歷屆試題討論版 was when the reader left it, by Next's key for it. */
const scrollPositions = new Map<string, number>();

function scrollToY(top: number) {
  // 'instant' overrides the global smooth scrolling for a whole-page jump.
  window.scrollTo({ top, behavior: 'instant' });
}

/**
 * A move to another paper or level (a paper's rows, the subject and year tiles): a new history
 * entry, from the top of the page, without loading the page again; `tab` is the tab to open
 * there. The page scrolls itself once the new place shows: asked to, Next would also scroll
 * to the top on Back to the entry.
 */
export function pushExamsPlace(
  router: NextRouter,
  slug: readonly string[],
  tab: ExamsTab = 'question',
) {
  void router
    .push({ pathname: router.pathname, query: examsQuery(slug, tab) }, undefined, {
      shallow: true,
      scroll: false,
    })
    .then((moved) => {
      if (moved) scrollToY(0);
    });
}

/**
 * Back and Forward inside 歷屆試題討論版 return to where the reader was on that entry, such as
 * the row of the paper they opened a question from, and stay on the loaded page.
 *
 * - Leaving an entry records how far down it was, just before Next writes the next entry and
 *   renders it. For Back and Forward the browser has already moved history.state on by then,
 *   which is how they are told from a move.
 * - The entry being left is marked shallow, as Next marks the ones it pushes. Next keeps a
 *   Back shallow only towards such an entry, so Back to the page the reader arrived on would
 *   otherwise download its data again and leave the old view on screen until it came.
 * - Once the entry Back or Forward led to has rendered, its position is put back at once. The
 *   browser's own restoring, which the site's smooth scrolling would animate, then finds the
 *   page already there.
 */
function useExamsScroll(router: NextRouter) {
  const { asPath, events } = router;
  // The entry on screen, from the last render; Back and Forward change history.state first.
  const current = useRef<string | undefined>(undefined);
  const popped = useRef(false);

  useEffect(() => {
    // Just before Next writes the entry and renders it, when the browser keeps its own record.
    function leave() {
      if (popped.current) return;
      const state = entryState();
      const key = current.current ?? state?.key;
      if (key) scrollPositions.set(key, window.scrollY);
      if (state?.key !== key) {
        // Back or Forward: the browser is already on the entry Next is about to render.
        popped.current = true;
        return;
      }
      const { shallow, scroll } = state?.options ?? {};
      if (state?.__N && !(shallow && scroll === false)) {
        window.history.replaceState(
          { ...state, options: { ...state.options, shallow: true, scroll: false } },
          '',
        );
      }
    }
    // Back and Forward, when Next has not got to them first. Next's own listener usually has,
    // and React renders the view it leads to before the event is over.
    function pop() {
      if (popped.current || entryState()?.key === current.current) return;
      if (current.current) scrollPositions.set(current.current, window.scrollY);
      popped.current = true;
    }
    function settle() {
      popped.current = false;
    }
    events?.on('beforeHistoryChange', leave);
    events?.on('routeChangeComplete', settle);
    events?.on('routeChangeError', settle);
    window.addEventListener('popstate', pop);
    return () => {
      events?.off('beforeHistoryChange', leave);
      events?.off('routeChangeComplete', settle);
      events?.off('routeChangeError', settle);
      window.removeEventListener('popstate', pop);
    };
  }, [events]);

  // Before paint: the entry Back or Forward led to, or the one Back from another page led into.
  useLayoutEffect(() => {
    const key = entryState()?.key;
    const returned = popped.current || current.current === undefined;
    popped.current = false;
    current.current = key;
    if (!returned) return;
    const top = key ? scrollPositions.get(key) : undefined;
    if (top !== undefined) scrollToY(top);
  }, [asPath]);
}

/**
 * 歷屆試題討論版 at every address under /exams. It draws no way back: every address starts with
 * the same subject and year selector, which the page puts at the top. It puts each entry back
 * where the reader left it, and remembers the address on screen for the sidebar. It renders
 * nothing of its own, so the page under it is never remounted by a move.
 */
export function ExamsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  useExamsScroll(router);
  useRememberExamsPlace(router);
  return <>{children}</>;
}
