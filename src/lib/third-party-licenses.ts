/**
 * The list of open-source packages in the JavaScript the site sends to browsers, with their
 * licence texts. The client production build writes it (src/build/third-party-licenses.ts) and
 * the 開源授權 page shows it.
 */

/** Written next to the client build's output: `.next/third-party-licenses.json`. */
export const THIRD_PARTY_LICENSES_FILE = 'third-party-licenses.json';

export interface ThirdPartyPackage {
  /** The npm name, e.g. `@firebase/app`. */
  name: string;
  /** null when the package is a copy inside another package that does not say its version. */
  version: string | null;
  /** The licence as the package states it (an SPDX expression such as `MIT AND Zlib`). */
  license: string;
  /** The project's web address, when the package names one. */
  homepage: string | null;
  /** The package that ships this one inside itself (Next.js carries several copies), or null. */
  bundledIn: string | null;
  /** The package's own licence files, or the standard text of its licence when it ships none. */
  licenseText: string;
  /** The SPDX ids whose standard text licenseText is, when the package ships no licence file. */
  standardText: string | null;
  /** With a standard text: the copyright lines in the package's code, and who the package names as its authors. */
  copyright: string[];
  /** The package's NOTICE file, when it has one. */
  notice: string | null;
}

export interface ThirdPartyLicenseReport {
  /** When the build made the list (ISO 8601). */
  generatedAt: string;
  packages: ThirdPartyPackage[];
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function isPackage(value: unknown): value is ThirdPartyPackage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.name) &&
    item.name.length > 0 &&
    isNullableString(item.version) &&
    isString(item.license) &&
    item.license.length > 0 &&
    isNullableString(item.homepage) &&
    isNullableString(item.bundledIn) &&
    isString(item.licenseText) &&
    item.licenseText.trim().length > 0 &&
    isNullableString(item.standardText) &&
    Array.isArray(item.copyright) &&
    item.copyright.every(isString) &&
    isNullableString(item.notice)
  );
}

/** Checks a parsed list; throws when it is not one, so a broken file never reaches the page. */
export function parseThirdPartyLicenseReport(value: unknown): ThirdPartyLicenseReport {
  if (!value || typeof value !== 'object') throw new Error('not an object');
  const report = value as Record<string, unknown>;
  if (!isString(report.generatedAt) || !Number.isFinite(Date.parse(report.generatedAt))) {
    throw new Error('generatedAt is not a date');
  }
  if (!Array.isArray(report.packages) || report.packages.length === 0) {
    throw new Error('packages is empty');
  }
  const broken = report.packages.findIndex((item) => !isPackage(item));
  if (broken !== -1) throw new Error(`packages[${broken}] is incomplete`);
  return {
    generatedAt: report.generatedAt,
    packages: report.packages as ThirdPartyPackage[],
  };
}

/** How many packages use each licence, most used first. */
export function countByLicense(packages: readonly Pick<ThirdPartyPackage, 'license'>[]) {
  const counts = new Map<string, number>();
  for (const item of packages)
    counts.set(item.license, (counts.get(item.license) ?? 0) + 1);
  return [...counts]
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license, 'en'));
}
