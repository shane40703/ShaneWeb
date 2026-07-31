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
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#f3f7fc" />
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
