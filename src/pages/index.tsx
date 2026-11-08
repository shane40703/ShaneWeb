import Head from 'next/head';
import { HomePage } from '@/features/home/home-page';
import { HOME_TITLE, SITE_NAME, SITE_URL } from '@/lib/site';

// Google takes the site's name from the home page, this first; the address is its fallback name.
const websiteStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: new URL(SITE_URL).host,
  url: `${SITE_URL}/`,
});

export default function HomeRoute() {
  return (
    <>
      <Head>
        <title>{HOME_TITLE}</title>
        <script
          key="website-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: websiteStructuredData }}
        />
      </Head>
      <HomePage />
    </>
  );
}
