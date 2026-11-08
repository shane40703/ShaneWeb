import { Head, Html, Main, NextScript } from 'next/document';
import { SITE_NAME } from '@/lib/site';
import { THEME_INITIALIZATION_SCRIPT } from '@/lib/theme';

export default function Document() {
  return (
    <Html
      lang="zh-Hant"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#eadfc9" />
        {/* Safari ignores display_override, so "display": "browser" keeps its icon opening Safari, where this site's data and sign-in are; Chrome installs from display_override. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        {/* Last, as browsers that do not choose by size tend to take the last icon: its tab sizes are drawn for tabs. */}
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <meta property="og:site_name" content={SITE_NAME} />
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
