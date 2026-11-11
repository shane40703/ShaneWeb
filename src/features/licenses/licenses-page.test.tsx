import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ThirdPartyPackage } from '@/lib/third-party-licenses';
import { readFileSync } from 'node:fs';
import {
  AGPL_URL,
  joinHardWraps,
  LicensesPage,
  SOURCE_CODE_URL,
  thirdPartyList,
} from './licenses-page';

afterEach(cleanup);

const mit = 'MIT License\n\nCopyright (c) Meta Platforms, Inc. and affiliates.';
const entry = (overrides: Partial<ThirdPartyPackage>): ThirdPartyPackage => ({
  name: 'react',
  version: '19.2.8',
  license: 'MIT',
  homepage: 'https://react.dev/',
  bundledIn: null,
  licenseText: mit,
  standardText: null,
  copyright: [],
  notice: null,
  ...overrides,
});

const list = thirdPartyList('115 年 11 月 11 日', [
  entry({
    name: '@firebase/app',
    version: '0.14.6',
    license: 'Apache-2.0',
    homepage: 'https://firebase.google.com/',
    licenseText: 'Apache License\nVersion 2.0, January 2004',
    standardText: 'Apache-2.0',
    copyright: ['Copyright 2017 Google LLC', 'Author: Firebase'],
  }),
  entry({ name: 'process', version: null, homepage: null, bundledIn: 'next' }),
  entry({}),
]);

describe('thirdPartyList', () => {
  it('sends a licence text that several packages share only once', () => {
    expect(list.licenseTexts).toEqual(['Apache License\nVersion 2.0, January 2004', mit]);
    expect(list.packages.map(({ licenseText }) => licenseText)).toEqual([0, 1, 1]);
  });
});

describe('joinHardWraps', () => {
  const spdx = (id: string) =>
    readFileSync(`src/build/license-texts/spdx/${id}.txt`, 'utf8');

  it('joins the wraps of the standard MIT text into one line per paragraph', () => {
    const text = spdx('MIT');
    const joined = joinHardWraps(text);

    expect(joined.split('\n\n')).toHaveLength(text.split('\n\n').length);
    expect(joined.split('\n').every((line) => !line.includes('  '))).toBe(true);
    expect(joined).toContain(
      'a copy of this software and associated documentation files (the "Software")',
    );
    expect(
      joined.startsWith('MIT License\n\nCopyright (c) <year> <copyright holders>\n\n'),
    ).toBe(true);
    expect(joined.replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('leaves short lines and the one-line paragraphs of Apache-2.0 alone', () => {
    const apache = spdx('Apache-2.0');
    expect(joinHardWraps(apache)).toBe(apache);
    expect(joinHardWraps(mit)).toBe(mit);
  });
});

describe('LicensesPage', () => {
  it('leaves the page title to the topbar and lists its sections in order', () => {
    render(<LicensesPage thirdParty={list} />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['網站程式碼', '字型', '考古題與法規', '網站圖示', '第三方套件']);
    expect(document.body).toHaveTextContent(
      '建築師大集結的程式碼採用 GNU Affero 通用公共授權條款第 3 版（AGPL v3）或之後的版本。',
    );
    expect(document.body).toHaveTextContent(
      '速記圖庫的整理圖由網站作者製作，也採用這個授權。',
    );
    expect(document.body).toHaveTextContent('依著作權法第 9 條，依法令舉行的考試試題');
  });

  it.each([
    ['原始碼', SOURCE_CODE_URL],
    ['授權條款全文', AGPL_URL],
  ])('opens %s in a new tab', (name, href) => {
    render(<LicensesPage thirdParty={list} />);

    // The arrow is decoration; the name says the link opens a new tab.
    const link = screen.getByRole('link', { name: `${name}（另開新分頁）` });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links each font to its OFL text on this site', () => {
    render(<LicensesPage thirdParty={list} />);

    expect(
      screen.getByRole('link', { name: '授權全文（Shane Daily Paper Ming）' }),
    ).toHaveAttribute('href', '/fonts/daily-paper/OFL.txt');
    expect(screen.getByRole('link', { name: '授權全文（Tinos）' })).toHaveAttribute(
      'href',
      '/fonts/daily-paper/OFL-Tinos.txt',
    );
  });

  it('counts the packages by licence and lists one row per package', () => {
    render(<LicensesPage thirdParty={list} />);

    expect(document.body).toHaveTextContent(
      '包含下面 3 個開源套件。這份清單在每次網站更新時',
    );
    expect(screen.getByText('清單更新：115 年 11 月 11 日')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: '各授權的套件數' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['MIT 2', 'Apache-2.0 1']);
    const rows = within(screen.getByRole('list', { name: '第三方套件' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.querySelector('summary')?.textContent)).toEqual([
      '@firebase/app0.14.6Apache-2.0',
      'process隨 next 附帶MIT',
      'react19.2.8MIT',
    ]);
  });

  it('opens a package to its licence text, saying when it is the standard text', () => {
    render(<LicensesPage thirdParty={list} />);

    const [firebase, , react] = within(
      screen.getByRole('list', { name: '第三方套件' }),
    ).getAllByRole('listitem');
    const details = firebase.querySelector('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(firebase.querySelector('summary')!);
    expect(details).toHaveAttribute('open');
    expect(firebase).toHaveTextContent(
      '套件沒有附上授權全文，以下是 Apache-2.0 的標準條文。',
    );
    expect(firebase.querySelector('pre')?.textContent).toBe(
      'Copyright 2017 Google LLC\nAuthor: Firebase\n\nApache License\nVersion 2.0, January 2004',
    );
    expect(
      within(firebase).getByRole('link', { name: /firebase\.google\.com/ }),
    ).toHaveAttribute('href', 'https://firebase.google.com/');

    expect(react).not.toHaveTextContent('標準條文');
    expect(react.querySelector('pre')?.textContent).toBe(mit);
    // Apache-2.0's template line sits in its appendix, so there is no blank to explain.
    expect(firebase).not.toHaveTextContent('<copyright holders>');
  });

  it('says which lines fill the blank copyright line of a standard MIT text', () => {
    const standardMit =
      'MIT License\n\nCopyright (c) <year> <copyright holders>\n\nPermission';
    render(
      <LicensesPage
        thirdParty={thirdPartyList('115 年 11 月 11 日', [
          entry({
            name: '@pdf-lib/fontkit',
            licenseText: standardMit,
            standardText: 'MIT',
            copyright: ['Copyright (c) 2012 Niklas von Hertzen', 'Author: Andrew Dillon'],
          }),
        ])}
      />,
    );

    const [fontkit] = within(
      screen.getByRole('list', { name: '第三方套件' }),
    ).getAllByRole('listitem');
    expect(fontkit).toHaveTextContent(
      '套件沒有附上授權全文，以下是 MIT 的標準條文。條文中的 <year> <copyright holders>，指的是最上面列出的版權聲明。',
    );
    expect(fontkit.querySelector('pre')?.textContent).toBe(
      `Copyright (c) 2012 Niklas von Hertzen\nAuthor: Andrew Dillon\n\n${standardMit}`,
    );
  });

  it('names every reason the paper falls back to the open fonts', () => {
    render(<LicensesPage thirdParty={list} />);

    expect(document.body).toHaveTextContent(
      '如果網站無法使用你電腦裡的新細明體或 Times New Roman（例如電腦沒有這兩套字型、瀏覽器不支援讀取本機字型，或你沒有允許讀取），就會改用下面兩套開源字型。',
    );
  });

  it('explains the missing list when the page runs without a production build', () => {
    render(<LicensesPage thirdParty={null} />);

    expect(screen.queryByRole('list', { name: '第三方套件' })).not.toBeInTheDocument();
    expect(document.body).toHaveTextContent('這份清單在正式建置網站時自動產生');
    expect(document.body).toHaveTextContent('條文見下方的 @tabler/icons-react');
  });
});
