import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Analytics } from '@/components/analytics';
import { PushMessages } from '@/components/push-messages';
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from '@/components/providers';
import { HOME_TITLE, SITE_NAME, SITE_URL } from '@/lib/site';
import '@/styles/globals.css';

export default function App({ Component, pageProps, router }: AppProps) {
  const hasOwnAddress = router.route !== '/404' && router.route !== '/_error';

  return (
    <>
      <Head>
        <title>{HOME_TITLE}</title>
        <meta
          name="description"
          content={`${SITE_NAME}：建築師考試考古題討論版、命題分析、詳解、筆記與難題整理。`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {hasOwnAddress ? (
          <link rel="canonical" href={`${SITE_URL}${router.asPath.split(/[?#]/)[0]}`} />
        ) : null}
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? (
          <meta
            name="google-site-verification"
            content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
          />
        ) : null}
      </Head>
      <Providers>
        <div className="app-root">
          <AppShell>
            <Component {...pageProps} />
          </AppShell>
        </div>
        <PushMessages search={router.asPath.split('?')[1]?.split('#')[0] ?? ''} />
      </Providers>
      <Analytics />
    </>
  );
}
