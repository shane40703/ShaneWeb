import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect } from 'react';
import { analyticsMeasurementId, trackPageView } from '@/lib/analytics';
import { useClientReady } from '@/lib/use-client-ready';

/** The same address without campaign parameters; nothing when it has none. */
function withoutCampaign(href: string) {
  const url = new URL(href);
  const names = [...url.searchParams.keys()].filter((name) => name.startsWith('utm_'));
  if (!names.length) return undefined;
  for (const name of names) url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function Analytics() {
  const router = useRouter();
  const ready = useClientReady();
  const measurementId = ready ? analyticsMeasurementId() : undefined;
  const path = router.asPath.split(/[?#]/)[0];

  // Keyed on the path; trackPageView decides that changing question is not a page view.
  // This component must stay after Providers in the tree: next/head sets document.title in
  // a passive effect, and this effect has to run after that one to read the new title.
  useEffect(() => {
    if (ready) trackPageView(path);
  }, [path, ready]);

  // Posts link to the home page. Once the page view above has taken the campaign, the address
  // bar and any link copied from it need not carry it. Other pages keep their address:
  // 每日抽題練習 takes a changed URL for the visitor's own navigation and moves its state to match.
  useEffect(() => {
    if (!ready || !router.isReady || router.pathname !== '/') return;
    const address = withoutCampaign(window.location.href);
    if (address)
      void router.replace(address, undefined, { shallow: true, scroll: false });
  }, [ready, router, router.asPath, router.isReady]);

  if (!measurementId) return null;
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="lazyOnload"
    />
  );
}
