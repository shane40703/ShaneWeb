import { Head, Html, Main, NextScript } from 'next/document';

const themeInitializationScript = `
  (function () {
    var theme = 'light';
    try {
      var savedTheme = window.localStorage.getItem('shane-web-theme');
      var prefersDark = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : (prefersDark ? 'dark' : 'light');
    } catch (_) {
      theme = window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', theme === 'dark' ? '#0b1120' : '#f3f7fc');
    }
  })();
`;

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
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
