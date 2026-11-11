// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ThirdPartyPackage } from '@/lib/third-party-licenses';
import {
  describeNextPolyfills,
  describePackage,
  extractCopyrightLines,
  licenseBanner,
  manifestLicense,
  manifestPeople,
  NEXT_POLYFILLS,
  packageForPath,
  pickLicenseFiles,
  projectUrl,
  sortPackages,
  spdxIds,
  ThirdPartyLicensesPlugin,
  type Compiler,
} from './third-party-licenses';

const repoRoot = process.cwd();

describe('packageForPath', () => {
  it.each([
    ['/app/node_modules/react/index.js', '/app/node_modules/react', 'react', null],
    [
      '/app/node_modules/@firebase/app/dist/esm/index.esm.js',
      '/app/node_modules/@firebase/app',
      '@firebase/app',
      null,
    ],
    [
      '/app/node_modules/pdf-lib/node_modules/tslib/tslib.es6.js',
      '/app/node_modules/pdf-lib/node_modules/tslib',
      'tslib',
      null,
    ],
    [
      '/app/node_modules/.pnpm/idb@7.1.1/node_modules/idb/build/index.js',
      '/app/node_modules/.pnpm/idb@7.1.1/node_modules/idb',
      'idb',
      null,
    ],
    [
      '/app/node_modules/next/dist/client/index.js',
      '/app/node_modules/next',
      'next',
      null,
    ],
    [
      '/app/node_modules/next/dist/compiled/process/browser.js',
      '/app/node_modules/next/dist/compiled/process',
      'process',
      'next',
    ],
    [
      '/app/node_modules/next/dist/compiled/@next/font/dist/index.js',
      '/app/node_modules/next/dist/compiled/@next/font',
      '@next/font',
      'next',
    ],
    [
      'C:\\app\\node_modules\\@tabler\\icons-react\\dist\\esm\\icons\\IconX.mjs',
      'C:/app/node_modules/@tabler/icons-react',
      '@tabler/icons-react',
      null,
    ],
  ])('%s belongs to %s', (file, root, name, bundledIn) => {
    expect(packageForPath(file)).toEqual({ root, name, bundledIn });
  });

  it('ignores the site’s own files and paths that stop at a package name', () => {
    expect(packageForPath('/app/src/pages/_app.tsx')).toBeNull();
    expect(packageForPath('/app/node_modules/react')).toBeNull();
    expect(packageForPath('/app/node_modules/@scope/index.js')).toBeNull();
  });
});

describe('pickLicenseFiles', () => {
  it('finds licence and notice files in any case or extension, but not code', () => {
    expect(
      pickLicenseFiles([
        'README.md',
        'license.md',
        'LICENSE-MIT',
        'LICENCE.txt',
        'COPYING',
        'NOTICE',
        'notice.md',
        'license.js',
        'package.json',
      ]),
    ).toEqual({
      license: ['COPYING', 'LICENCE.txt', 'LICENSE-MIT', 'license.md'],
      notice: ['NOTICE', 'notice.md'],
    });
  });
});

describe('spdxIds', () => {
  it('splits an expression into its licences', () => {
    expect(spdxIds('MIT')).toEqual(['MIT']);
    expect(spdxIds('(MIT AND Zlib)')).toEqual(['MIT', 'Zlib']);
    expect(spdxIds('(MIT OR Apache-2.0)')).toEqual(['MIT', 'Apache-2.0']);
  });
});

describe('extractCopyrightLines', () => {
  it('reads @license headers and plain comments', () => {
    const source = [
      '/**',
      ' * @license',
      ' * Copyright 2017 Google LLC',
      ' *',
      ' * Licensed under the Apache License, Version 2.0 (the "License");',
      ' */',
      'const a = 1;',
      '/*! @license Copyright 2019 Google LLC SPDX-License-Identifier: Apache-2.0 */',
      '// Copyright Joyent, Inc. and other Node contributors.',
      '/** Copyright 2017 Google LLC. */',
      '// Copyright 2024 Google LLC* @license',
      '/* (c) 2014-2017 Vitaly Puzrin */',
    ].join('\n');
    expect(extractCopyrightLines(source)).toEqual([
      '(c) 2014-2017 Vitaly Puzrin',
      'Copyright 2017 Google LLC',
      'Copyright 2019 Google LLC',
      'Copyright 2024 Google LLC',
      'Copyright Joyent, Inc. and other Node contributors.',
    ]);
  });

  it('skips licence sentences about copyright and words outside comments', () => {
    const source = [
      '// The above copyright notice and this permission notice shall be included',
      '// copyright notice and this permission notice appear in all copies.',
      '// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE',
      '// (c) Use FAILED_PRECONDITION if the client should not retry until',
      'const names = ["copyright", "Copyright 2020 Not A Comment"];',
    ].join('\n');
    expect(extractCopyrightLines(source)).toEqual([]);
  });
});

describe('package.json fields', () => {
  it('reads the licence in its old and new shapes', () => {
    expect(manifestLicense({ license: 'MIT' })).toBe('MIT');
    expect(manifestLicense({ license: { type: 'ISC' } })).toBe('ISC');
    expect(manifestLicense({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe(
      '(MIT OR Apache-2.0)',
    );
    expect(manifestLicense({})).toBeNull();
  });

  it('turns homepages and repositories into browsable addresses', () => {
    expect(projectUrl({ homepage: 'https://react.dev/' })).toBe('https://react.dev/');
    expect(projectUrl({ homepage: 'https://github.com/a/b#readme' })).toBe(
      'https://github.com/a/b',
    );
    expect(projectUrl({ repository: { url: 'git+https://github.com/a/b.git' } })).toBe(
      'https://github.com/a/b',
    );
    expect(projectUrl({ repository: 'git://github.com/Hopding/fontkit.git' })).toBe(
      'https://github.com/Hopding/fontkit',
    );
    expect(projectUrl({ repository: 'git@github.com:a/b.git' })).toBe(
      'https://github.com/a/b',
    );
    expect(projectUrl({ repository: 'nodeca/pako' })).toBe(
      'https://github.com/nodeca/pako',
    );
    expect(projectUrl({ repository: 'gitlab:a/b' })).toBe('https://gitlab.com/a/b');
    expect(projectUrl({})).toBeNull();
  });

  it('names the authors without their contact details', () => {
    expect(
      manifestPeople({
        author: 'Andrew Dillon <andrew@example.com>',
        contributors: ['Devon Govett <devon@example.com> (http://example.com/)'],
      }),
    ).toEqual(['Author: Andrew Dillon', 'Contributors: Devon Govett']);
    expect(
      manifestPeople({ author: { name: 'Firebase', email: 'a@example.com' } }),
    ).toEqual(['Author: Firebase']);
    expect(manifestPeople({})).toEqual([]);
  });
});

describe('sortPackages', () => {
  const item = (name: string, version: string | null, bundledIn: string | null = null) =>
    ({ name, version, bundledIn }) as ThirdPartyPackage;

  it('orders by name and drops repeats of the same version', () => {
    expect(
      sortPackages([
        item('react', '19.2.8'),
        item('@firebase/app', '0.14.0'),
        item('react', '19.2.8'),
        item('process', null, 'next'),
        item('idb', '7.1.1'),
      ]).map(({ name }) => name),
    ).toEqual(['@firebase/app', 'idb', 'process', 'react']);
  });
});

describe('licenseBanner', () => {
  it('is one ASCII comment the minifier would keep', () => {
    expect(licenseBanner('https://exam-tw.vercel.app/licenses')).toBe(
      '/*! Third-party licenses: https://exam-tw.vercel.app/licenses */',
    );
    expect(() => licenseBanner('https://例子.tw/licenses')).toThrow();
    expect(() => licenseBanner('https://a.tw/*/')).toThrow();
  });
});

function fixturePackage(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'licenses-'));
  const packageRoot = path.join(root, 'node_modules', 'pkg');
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(packageRoot, name)), { recursive: true });
    writeFileSync(path.join(packageRoot, name), content);
  }
  return { root, packageRoot };
}

describe('describePackage', () => {
  it('keeps the package’s own licence and NOTICE files', () => {
    const { packageRoot } = fixturePackage({
      'package.json': JSON.stringify({
        name: 'pkg',
        version: '1.2.3',
        license: 'Apache-2.0',
        repository: 'a/pkg',
      }),
      LICENSE: 'Own licence text\r\n',
      NOTICE: 'Notice text',
      'index.js': '/** Copyright 2020 Someone */',
    });
    expect(
      describePackage(
        { root: packageRoot, name: 'pkg', bundledIn: null },
        [path.join(packageRoot, 'index.js')],
        repoRoot,
      ),
    ).toEqual({
      name: 'pkg',
      version: '1.2.3',
      license: 'Apache-2.0',
      homepage: 'https://github.com/a/pkg',
      bundledIn: null,
      licenseText: 'Own licence text',
      standardText: null,
      copyright: [],
      notice: 'Notice text',
    });
  });

  it('falls back to the standard text with the copyright lines in its code', () => {
    const { packageRoot } = fixturePackage({
      'package.json': JSON.stringify({
        name: '@firebase/pkg',
        version: '0.1.0',
        license: 'Apache-2.0',
        author: 'Firebase <firebase-support@google.com>',
      }),
      'dist/index.js': '/**\n * @license\n * Copyright 2017 Google LLC\n */\nexport {};',
    });
    const entry = describePackage(
      { root: packageRoot, name: 'pkg', bundledIn: null },
      [path.join(packageRoot, 'dist/index.js')],
      repoRoot,
    );
    expect(entry.name).toBe('@firebase/pkg');
    expect(entry.standardText).toBe('Apache-2.0');
    expect(entry.copyright).toEqual(['Copyright 2017 Google LLC', 'Author: Firebase']);
    expect(entry.licenseText).toMatch(/^Apache License\s+Version 2\.0, January 2004/);
  });

  it('fails clearly when there is no licence at all, or no standard text for it', () => {
    const bare = fixturePackage({ 'package.json': '{"name":"pkg","version":"1.0.0"}' });
    expect(() =>
      describePackage(
        { root: bare.packageRoot, name: 'pkg', bundledIn: null },
        [],
        repoRoot,
      ),
    ).toThrow(/neither a licence file nor a licence in package.json/);

    const unknown = fixturePackage({
      'package.json': '{"name":"pkg","version":"1.0.0","license":"WTFPL"}',
    });
    expect(() =>
      describePackage(
        { root: unknown.packageRoot, name: 'pkg', bundledIn: null },
        [],
        repoRoot,
      ),
    ).toThrow(/spdx\/license-list-data\/main\/text\/WTFPL\.txt/);
  });
});

describe('describeNextPolyfills', () => {
  it('stops the build when Next.js ships a different polyfill file', () => {
    expect(() => describeNextPolyfills('changed', repoRoot)).toThrow(
      /polyfill file changed/,
    );
  });

  it('lists the pinned packages of the installed Next.js file, with their upstream licences', () => {
    // Fails after a Next.js upgrade that changes the file, like the build would.
    const source = readFileSync(
      path.join(repoRoot, 'node_modules/next/dist/build/polyfills/polyfill-nomodule.js'),
      'utf8',
    );
    expect(createHash('sha256').update(source).digest('hex')).toBe(NEXT_POLYFILLS.sha256);
    const entries = describeNextPolyfills(source, repoRoot);
    expect(entries.map(({ name, version }) => `${name}@${version}`)).toEqual([
      'core-js@3.38.1',
      'object-assign@4.1.1',
      'whatwg-fetch@3.0.0',
    ]);
    expect(entries.every((entry) => entry.bundledIn === 'next')).toBe(true);
    expect(entries[0].licenseText).toMatch(/^Copyright \(c\) 2014-2024 Denis Pushkarev/);
    // The file says which core-js it carries; the pinned version must be that one.
    expect(source).toContain('core-js/blob/v3.38.1/LICENSE');
  });
});

describe('ThirdPartyLicensesPlugin', () => {
  /** Just enough of webpack to run the plugin's processAssets step. */
  function runPlugin(modules: unknown[], assets: Record<string, string>) {
    const store = new Map(Object.entries(assets).map(([name, text]) => [name, text]));
    const errors: unknown[] = [];
    let processAssets: () => void = () => {};
    const compilation = {
      chunks: ['main'],
      chunkGraph: {
        getChunkModulesIterable: () => modules,
        getChunkRuntimeModulesIterable: () => [],
      },
      errors,
      hooks: {
        processAssets: { tap: (_: unknown, run: () => void) => (processAssets = run) },
      },
      getAssets: () =>
        [...store].map(([name, text]) => ({ name, source: { source: () => text } })),
      emitAsset: (name: string, source: { source(): string }) =>
        store.set(name, source.source()),
      updateAsset: (
        name: string,
        update: (source: { source(): string }) => { source(): string },
      ) => store.set(name, update({ source: () => store.get(name)! }).source()),
    };
    class Text {
      constructor(private readonly text: string) {}
      source() {
        return this.text;
      }
    }
    const compiler = {
      webpack: {
        version: '5.98.0',
        Compilation: { PROCESS_ASSETS_STAGE_REPORT: 5000 },
        sources: {
          RawSource: Text,
          ConcatSource: class {
            constructor(...parts: Array<string | { source(): string }>) {
              return new Text(
                parts
                  .map((part) => (typeof part === 'string' ? part : part.source()))
                  .join(''),
              );
            }
          },
        },
        WebpackError: Error,
      },
      hooks: {
        thisCompilation: {
          tap: (_: string, run: (c: unknown) => void) => run(compilation),
        },
      },
    } as unknown as Compiler;
    new ThirdPartyLicensesPlugin({
      rootDir: repoRoot,
      bannerUrl: 'https://exam-tw.vercel.app/licenses',
    }).apply(compiler);
    processAssets();
    return { store, errors };
  }

  const file = (name: string) => ({ nameForCondition: () => name });

  it('lists the packages in the chunks, opening concatenated modules, and marks every script', () => {
    const { store, errors } = runPlugin(
      [
        file(path.join(repoRoot, 'src/pages/_app.tsx')),
        { modules: [file(path.join(repoRoot, 'node_modules/idb/build/index.js'))] },
        file(path.join(repoRoot, 'node_modules/react/index.js')),
      ],
      { 'static/chunks/main-abc.js': 'console.log(1)', 'static/css/a.css': 'a{}' },
    );
    expect(errors).toEqual([]);
    const report = JSON.parse(store.get('third-party-licenses.json')!);
    expect(report.packages.map(({ name }: ThirdPartyPackage) => name)).toEqual([
      'idb',
      'react',
    ]);
    expect(report.packages[0]).toMatchObject({ license: 'ISC', standardText: null });
    expect(store.get('static/chunks/main-abc.js')).toBe(
      '/*! Third-party licenses: https://exam-tw.vercel.app/licenses */\nconsole.log(1)',
    );
    expect(store.get('static/css/a.css')).toBe('a{}');
  });

  it('turns a problem into a build error instead of writing an incomplete list', () => {
    const { store, errors } = runPlugin([], {
      'static/chunks/polyfills-abc.js': 'changed',
    });
    expect(store.has('third-party-licenses.json')).toBe(false);
    expect(String(errors[0])).toMatch(/polyfill file changed/);
  });
});
