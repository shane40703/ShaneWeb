// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ThirdPartyLicenseReport } from '@/lib/third-party-licenses';
import { formatRocDate, readThirdPartyLicenses } from './third-party-licenses.server';

const report: ThirdPartyLicenseReport = {
  generatedAt: '2026-11-11T02:00:00.000Z',
  packages: [
    {
      name: 'react',
      version: '19.2.8',
      license: 'MIT',
      homepage: 'https://react.dev/',
      bundledIn: null,
      licenseText: 'MIT License',
      standardText: null,
      copyright: [],
      notice: null,
    },
  ],
};

function projectWith(content?: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'licenses-page-'));
  if (content !== undefined) {
    mkdirSync(path.join(root, '.next'));
    writeFileSync(path.join(root, '.next', 'third-party-licenses.json'), content);
  }
  return root;
}

describe('readThirdPartyLicenses', () => {
  it('reads the list the build wrote', async () => {
    const root = projectWith(JSON.stringify(report));
    await expect(readThirdPartyLicenses({ root, production: true })).resolves.toEqual(
      report,
    );
  });

  it.each([
    ['missing', undefined],
    ['not JSON', '{'],
    ['empty', JSON.stringify({ ...report, packages: [] })],
    [
      'without licence text',
      JSON.stringify({
        ...report,
        packages: [{ ...report.packages[0], licenseText: ' ' }],
      }),
    ],
  ])('stops a production build when the list is %s', async (_, content) => {
    const root = projectWith(content);
    await expect(readThirdPartyLicenses({ root, production: true })).rejects.toThrow(
      /\/licenses page needs .*third-party-licenses\.json.*next build --webpack/s,
    );
    await expect(readThirdPartyLicenses({ root, production: false })).resolves.toBeNull();
  });
});

describe('formatRocDate', () => {
  it('writes the Taiwan date in 民國 years', () => {
    expect(formatRocDate('2026-11-10T16:30:00.000Z')).toBe('115 年 11 月 11 日');
    expect(formatRocDate('2026-01-05T03:00:00.000Z')).toBe('115 年 1 月 5 日');
  });
});
