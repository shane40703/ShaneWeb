import { useRouter } from 'next/router';
import Script from 'next/script';
import { useEffect } from 'react';
import { analyticsMeasurementId, trackPageView } from '@/lib/analytics';
import { useClientReady } from '@/lib/use-client-ready';

export function Analytics() {
  const router = useRouter();
  const ready = useClientReady();
  const measurementId = ready ? analyticsMeasurementId() : undefined;
  const path = router.asPath.split(/[?#]/)[0];

  // Keyed on the path: changing question only changes the query and is not a page view.
  // This component must stay after Providers in the tree: next/head sets document.title in
  // a passive effect, and this effect has to run after that one to read the new title.
  useEffect(() => {
    if (ready) trackPageView(path);
  }, [path, ready]);

  if (!measurementId) return null;
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="lazyOnload"
    />
  );
}
