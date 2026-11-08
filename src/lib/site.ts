/** The public address: canonical links and the sitemap name this one, whatever served the page. */
export const SITE_URL = 'https://exam-tw.vercel.app';

/**
 * The site's name: the one Google is asked to show for the site in search results, the start of
 * the home page's title, the sidebar's brand, the top bar's title on addresses with no name of
 * their own, the first words of the default description, and the name under its Home Screen icon
 * (the manifest, a static file, repeats it). Every other page's tab keeps the 「｜建築師考試」
 * suffix on purpose: it names the exam the page is about, in the words people search for.
 */
export const SITE_NAME = '建築師大集結';

/** The home page's tab: the site's name first, then what it is, keeping the 考古題 people search for. */
export const HOME_TITLE = `${SITE_NAME}｜建築師考試考古題練習平台`;
