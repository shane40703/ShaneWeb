import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseThirdPartyLicenseReport,
  THIRD_PARTY_LICENSES_FILE,
  type ThirdPartyLicenseReport,
} from '@/lib/third-party-licenses';

/**
 * The package list the client production build wrote (src/build/third-party-licenses.ts), for the
 * 開源授權 page's getStaticProps. A production build must not publish the page without it, so
 * there a missing or broken file stops the build. `next dev` never writes the file: it shows the
 * last production build's list when there is one, otherwise null.
 */
export async function readThirdPartyLicenses({
  root = process.cwd(),
  production = process.env.NODE_ENV === 'production',
}: {
  root?: string;
  production?: boolean;
} = {}): Promise<ThirdPartyLicenseReport | null> {
  const file = path.join(root, '.next', THIRD_PARTY_LICENSES_FILE);
  try {
    return parseThirdPartyLicenseReport(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if (!production) return null;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The /licenses page needs ${path.join('.next', THIRD_PARTY_LICENSES_FILE)}, which the ` +
        'client webpack build writes (src/build/third-party-licenses.ts, added in next.config.ts). ' +
        `Build with \`next build --webpack\`. (${reason})`,
    );
  }
}

/** A date the way the site writes it, in Taiwan time: 「115 年 11 月 11 日」. */
export function formatRocDate(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
      .formatToParts(new Date(iso))
      .map(({ type, value }) => [type, Number(value)]),
  );
  return `${parts.year - 1911} 年 ${parts.month} 月 ${parts.day} 日`;
}
