import { Head, Html, Main, NextScript } from 'next/document';
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
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="建築師考試" />
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
