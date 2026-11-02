import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import styles from './app-shell.module.css';

/**
 * Next's route loader can drop a click for good on a slow line: when a prefetch of the same
 * route passes its 3.8 s timeout the click's promise is never settled and nothing else happens.
 * A full load is what the router itself falls back to, so this does the same a little later.
 */
const STUCK_ROUTE_MS = 6000;

function pathOf(url: string) {
  return url.split(/[?#]/)[0] || '/';
}

/** A catch-all route such as /exams/[[...slug]] is one page for every address under it. */
export function staysOnPage(route: string, path: string) {
  const [base, catchAll] = route.split('/[[...');
  if (path === route) return true;
  return catchAll !== undefined && (path === base || path.startsWith(`${base}/`));
}

/** The page a click is on its way to, from the moment of the click. */
export function usePendingRoute() {
  const router = useRouter();
  const events = router.events;
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!events) return;
    let stuck = 0;
    const settle = () => {
      window.clearTimeout(stuck);
      setPending(null);
    };
    const start = (url: string, { shallow }: { shallow: boolean }) => {
      if (shallow) return;
      window.clearTimeout(stuck);
      stuck = window.setTimeout(() => window.location.assign(url), STUCK_ROUTE_MS);
      setPending(pathOf(url));
    };
    // Back into this page after the full load: the page in the back/forward cache is still leaving.
    const restored = ({ persisted }: PageTransitionEvent) => {
      if (persisted) settle();
    };
    events.on('routeChangeStart', start);
    events.on('routeChangeComplete', settle);
    events.on('routeChangeError', settle);
    window.addEventListener('pageshow', restored);
    return () => {
      window.clearTimeout(stuck);
      window.removeEventListener('pageshow', restored);
      events.off('routeChangeStart', start);
      events.off('routeChangeComplete', settle);
      events.off('routeChangeError', settle);
    };
  }, [events]);

  return pending;
}

/** One line of the only pen, drawn under the topbar. It waits a beat, so fast switches stay quiet. */
export function RouteProgress({ active }: { active: boolean }) {
  return active ? <span className={styles.routeProgress} aria-hidden="true" /> : null;
}

/** A blank ruled sheet for a page whose code has not arrived yet. */
export function RouteSheet() {
  return (
    <div className={styles.routeSheet} role="status" aria-label="正在開啟頁面">
      <span />
    </div>
  );
}
