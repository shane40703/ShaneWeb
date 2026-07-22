import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from '@/components/providers';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>建築師考試考古題練習平台</title>
        <meta
          name="description"
          content="建築師考試歷屆試題、隨機練習、命題分析、詳解、筆記與難題整理。"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Providers>
        <div className="app-root">
          <AppShell>
            <Component {...pageProps} />
          </AppShell>
        </div>
      </Providers>
    </>
  );
}
