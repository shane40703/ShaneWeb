/**
 * Lists the open-source packages in the JavaScript the site sends to browsers, with their licence
 * texts, for the 開源授權 page (/licenses).
 *
 * The minifier strips every licence comment from the browser bundles, so the notices MIT, ISC,
 * BSD and Apache-2.0 ask for travel on that page instead. next.config.ts adds
 * ThirdPartyLicensesPlugin to the client production compilation only: once the chunks are final it
 * walks the modules each chunk really contains, maps every file under node_modules to its package,
 * and writes .next/third-party-licenses.json, which the page reads at build time. It also starts
 * every browser script with a one-line comment pointing at that page.
 *
 * next.config.ts imports this file while Next.js loads its config, so it may only import Node
 * built-ins and files by relative path.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  THIRD_PARTY_LICENSES_FILE,
  type ThirdPartyLicenseReport,
  type ThirdPartyPackage,
} from '../lib/third-party-licenses';

/** Licence texts kept in the repository: SPDX standard texts and upstream files (see below). */
const LICENSE_TEXTS_DIR = path.join('src', 'build', 'license-texts');

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

export interface PackageLocation {
  /** The package's folder, in forward slashes. */
  root: string;
  /** The name the folder gives, e.g. `@firebase/app`; package.json may say more. */
  name: string;
  /** `next` for the copies Next.js keeps in next/dist/compiled, otherwise null. */
  bundledIn: string | null;
}

/**
 * The package a bundled file belongs to: the folder after the last `node_modules/` (two levels for
 * a scoped name), so nested and pnpm-style installs land on the copy really used. Next.js vendors
 * other packages under next/dist/compiled/<name>, each with its own licence; those count as their
 * own package, carried by next.
 */
export function packageForPath(file: string): PackageLocation | null {
  const normalized = file.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return null;
  const parts = normalized.slice(index + marker.length).split('/');
  const nameLength = parts[0]?.startsWith('@') ? 2 : 1;
  // A package is a folder: the path must go on past its name.
  if (parts.length <= nameLength || parts.slice(0, nameLength).some((part) => !part))
    return null;
  const name = parts.slice(0, nameLength).join('/');
  const root = `${normalized.slice(0, index + marker.length)}${name}`;

  const rest = parts.slice(nameLength);
  if (name === 'next' && rest[0] === 'dist' && rest[1] === 'compiled') {
    const vendoredLength = rest[2]?.startsWith('@') ? 2 : 1;
    const vendored = rest.slice(2, 2 + vendoredLength);
    if (rest.length > 2 + vendoredLength && vendored.every(Boolean)) {
      const vendoredName = vendored.join('/');
      return {
        root: `${root}/dist/compiled/${vendoredName}`,
        name: vendoredName,
        bundledIn: 'next',
      };
    }
  }
  return { root, name, bundledIn: null };
}

const CODE_FILE = /\.(?:[cm]?[jt]sx?|d\.ts|json|map)$/i;

/** Which of a package folder's files are its licence (LICENSE, LICENCE, COPYING…) and NOTICE files. */
export function pickLicenseFiles(fileNames: readonly string[]) {
  const sorted = [...fileNames].filter((name) => !CODE_FILE.test(name)).sort();
  return {
    license: sorted.filter((name) => /^(?:licen[cs]e|copying)(?:[-_.].*)?$/i.test(name)),
    notice: sorted.filter((name) => /^notice(?:[-_.].*)?$/i.test(name)),
  };
}

/** The SPDX ids in a licence expression such as `(MIT OR Apache-2.0)` or `MIT AND Zlib`. */
export function spdxIds(expression: string): string[] {
  const ids = expression
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !/^(?:AND|OR|WITH)$/i.test(word))
    .map((word) => word.replace(/\+$/, ''));
  return [...new Set(ids)];
}

/**
 * Copyright lines in source code comments, e.g. a `@license` header's `Copyright 2017 Google LLC`.
 * Only comment text is read, a line must start with Copyright, (c) or ©, and sentences that only
 * talk about "copyright notices" or "copyright holders" are left out.
 */
export function extractCopyrightLines(source: string): string[] {
  // One line per holder and year: "Copyright 2020 Google LLC." and "…LLC" are the same notice.
  const found = new Map<string, string>();
  const comments = source.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) ?? [];
  for (const comment of comments) {
    for (const rawLine of comment.split('\n')) {
      const line = rawLine
        .replace(/^\s*(?:\/\*+!?|\/\/+|\*+(?!\/))\s?/, '')
        .replace(/\*+\/\s*$/, '')
        .replace(/^@license\s+/i, '')
        .replace(/\s*\*?\s*@license\s*$/i, '')
        .replace(/\s+SPDX-License-Identifier:.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      // "(c)" alone also numbers list items, so it needs a year after it.
      if (!/^(?:copyright\b|(?:\(c\)|©)\s*\d{4})/i.test(line)) continue;
      if (/^copyright\s+(?:notices?|holders?|owners?|and\b|law|\(c\)\s*$)/i.test(line))
        continue;
      if (line.length > 200 || !/[a-z]{2}/i.test(line.replace(/^copyright/i, '')))
        continue;
      const key = line.replace(/[.\s]+$/, '').toLowerCase();
      const known = found.get(key);
      if (!known || line.length < known.length) found.set(key, line);
    }
  }
  return [...found.values()].sort();
}

interface PackageManifest {
  name?: unknown;
  version?: unknown;
  license?: unknown;
  licenses?: unknown;
  homepage?: unknown;
  repository?: unknown;
  author?: unknown;
  contributors?: unknown;
}

/** The licence the manifest states, as one SPDX expression; null when it states none. */
export function manifestLicense(manifest: PackageManifest): string | null {
  const name = (value: unknown) =>
    typeof value === 'string'
      ? value
      : value &&
          typeof value === 'object' &&
          typeof (value as { type?: unknown }).type === 'string'
        ? (value as { type: string }).type
        : null;
  const single = name(manifest.license);
  if (single?.trim()) return single.trim();
  if (Array.isArray(manifest.licenses)) {
    const all = manifest.licenses
      .map(name)
      .filter((value): value is string => !!value?.trim());
    if (all.length === 1) return all[0];
    if (all.length > 1) return `(${all.join(' OR ')})`;
  }
  return null;
}

/** A browsable https address from a manifest's homepage, else its repository. */
export function projectUrl(manifest: PackageManifest): string | null {
  const repository =
    typeof manifest.repository === 'string'
      ? manifest.repository
      : manifest.repository && typeof manifest.repository === 'object'
        ? (manifest.repository as { url?: unknown }).url
        : undefined;
  for (const candidate of [manifest.homepage, repository]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    let url = candidate.trim();
    const shorthand = url.match(/^(?:(github|gitlab|bitbucket):)?([\w.-]+\/[\w.-]+)$/);
    if (shorthand) {
      const host = {
        github: 'github.com',
        gitlab: 'gitlab.com',
        bitbucket: 'bitbucket.org',
      };
      url = `https://${host[(shorthand[1] ?? 'github') as keyof typeof host]}/${shorthand[2]}`;
    }
    url = url
      .replace(/^git\+/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^ssh:\/\/git@/, 'https://')
      .replace(/^git@([^:/]+):/, 'https://$1/')
      .replace(/\.git(?=$|#)/, '')
      .replace(/#readme$/, '');
    if (/^https?:\/\/[^\s]+$/.test(url)) return url;
  }
  return null;
}

/** The people a manifest names: `Author: …` and `Contributors: …` lines, names only. */
export function manifestPeople(manifest: PackageManifest): string[] {
  const personName = (value: unknown) => {
    const raw =
      typeof value === 'string'
        ? value
        : value && typeof value === 'object'
          ? (value as { name?: unknown }).name
          : undefined;
    if (typeof raw !== 'string') return null;
    const cleaned = raw
      .replace(/<[^>]*>|\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || null;
  };
  const lines: string[] = [];
  const author = personName(manifest.author);
  if (author) lines.push(`Author: ${author}`);
  const contributors = Array.isArray(manifest.contributors)
    ? manifest.contributors.map(personName).filter((value): value is string => !!value)
    : [];
  if (contributors.length) lines.push(`Contributors: ${contributors.join(', ')}`);
  return lines;
}

/** Stable order, one entry per name, version and carrier. */
export function sortPackages(
  packages: readonly ThirdPartyPackage[],
): ThirdPartyPackage[] {
  const key = (item: ThirdPartyPackage) =>
    `${item.name}\u0000${item.version ?? ''}\u0000${item.bundledIn ?? ''}`;
  const unique = new Map<string, ThirdPartyPackage>();
  for (const item of packages) if (!unique.has(key(item))) unique.set(key(item), item);
  return [...unique.values()].sort((a, b) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0,
  );
}

/** The comment every browser script starts with. ASCII only, so no encoding can garble it. */
export function licenseBanner(pageUrl: string) {
  const banner = `/*! Third-party licenses: ${pageUrl} */`;
  if (!/^[\x20-\x7e]+$/.test(pageUrl) || pageUrl.includes('*/')) {
    throw new Error(`The licence banner must be plain ASCII: ${pageUrl}`);
  }
  return banner;
}

// ---------------------------------------------------------------------------------------------
// Reading packages from disk
// ---------------------------------------------------------------------------------------------

function readText(file: string) {
  return readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').trim();
}

function readManifest(root: string): PackageManifest {
  const file = path.join(root, 'package.json');
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as PackageManifest)
    : {};
}

/** The repository's copy of an SPDX standard text, downloaded verbatim from spdx/license-list-data. */
function standardText(rootDir: string, id: string) {
  const file = path.join(rootDir, LICENSE_TEXTS_DIR, 'spdx', `${id}.txt`);
  if (!existsSync(file)) {
    throw new Error(
      `No standard text for ${id}. Download https://raw.githubusercontent.com/spdx/license-list-data/main/text/${id}.txt to ${path.join(LICENSE_TEXTS_DIR, 'spdx', `${id}.txt`)}.`,
    );
  }
  return readText(file);
}

/**
 * One package's entry. `files` are the package's files the bundle contains; they are read for
 * copyright lines only when the package ships no licence file of its own.
 */
export function describePackage(
  location: PackageLocation,
  files: readonly string[],
  rootDir: string,
): ThirdPartyPackage {
  const manifest = readManifest(location.root);
  const name =
    typeof manifest.name === 'string' && manifest.name ? manifest.name : location.name;
  const version =
    typeof manifest.version === 'string' && manifest.version ? manifest.version : null;
  const license = manifestLicense(manifest);
  const { license: licenseFiles, notice: noticeFiles } = pickLicenseFiles(
    readdirSync(location.root, { withFileTypes: true })
      .filter((entry) => entry.isFile() || entry.isSymbolicLink())
      .map((entry) => entry.name),
  );
  const own = licenseFiles
    .map((file) => readText(path.join(location.root, file)))
    .filter(Boolean);
  const notice = noticeFiles
    .map((file) => readText(path.join(location.root, file)))
    .filter(Boolean);
  const label = `${name}${version ? `@${version}` : ''} (${location.root})`;

  if (own.length) {
    return {
      name,
      version,
      license: license ?? 'SEE LICENSE',
      homepage: projectUrl(manifest),
      bundledIn: location.bundledIn,
      licenseText: own.join('\n\n'),
      standardText: null,
      copyright: [],
      notice: notice.length ? notice.join('\n\n') : null,
    };
  }
  if (!license)
    throw new Error(`${label} has neither a licence file nor a licence in package.json.`);
  const ids = spdxIds(license);
  const copyright = new Set<string>();
  for (const file of files) {
    for (const line of extractCopyrightLines(readFileSync(file, 'utf8')))
      copyright.add(line);
  }
  return {
    name,
    version,
    license,
    homepage: projectUrl(manifest),
    bundledIn: location.bundledIn,
    licenseText: ids.map((id) => standardText(rootDir, id)).join('\n\n'),
    standardText: ids.join(', '),
    copyright: [...[...copyright].sort(), ...manifestPeople(manifest)],
    notice: notice.length ? notice.join('\n\n') : null,
  };
}

/**
 * Next.js serves browsers without module support a prebuilt polyfill file
 * (next/dist/build/polyfills/polyfill-nomodule.js → static/chunks/polyfills-*.js). It is copied,
 * not bundled, so it has no modules to walk and its licence comments are already gone. Next.js
 * 16.2.11 builds it from these pinned packages (packages/next-polyfill-nomodule in the Next.js
 * repository); their licence files sit in license-texts/next-polyfills, copied from each project
 * at that tag. The hash stops the build when an upgrade changes the file, so the list is checked
 * again instead of going stale.
 */
export const NEXT_POLYFILLS = {
  sha256: '0973c1d64c88adc8e3c950410cb58b288f72118d5965b78049438deb8f2f9683',
  asset: /^static\/chunks\/polyfills(?:-[^/]+)?\.js$/,
  packages: [
    {
      name: 'core-js',
      version: '3.38.1',
      license: 'MIT',
      homepage: 'https://github.com/zloirock/core-js',
      file: 'core-js.txt',
    },
    {
      name: 'object-assign',
      version: '4.1.1',
      license: 'MIT',
      homepage: 'https://github.com/sindresorhus/object-assign',
      file: 'object-assign.txt',
    },
    {
      name: 'whatwg-fetch',
      version: '3.0.0',
      license: 'MIT',
      homepage: 'https://github.com/github/fetch',
      file: 'whatwg-fetch.txt',
    },
  ],
} as const;

export function describeNextPolyfills(
  source: string,
  rootDir: string,
): ThirdPartyPackage[] {
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== NEXT_POLYFILLS.sha256) {
    throw new Error(
      `Next.js's legacy-browser polyfill file changed (sha256 ${hash}). Check which packages ` +
        'packages/next-polyfill-nomodule bundles for this Next.js version, then update ' +
        'NEXT_POLYFILLS and license-texts/next-polyfills in src/build/third-party-licenses.ts.',
    );
  }
  return NEXT_POLYFILLS.packages.map((item) => ({
    name: item.name,
    version: item.version,
    license: item.license,
    homepage: item.homepage,
    bundledIn: 'next',
    licenseText: readText(
      path.join(rootDir, LICENSE_TEXTS_DIR, 'next-polyfills', item.file),
    ),
    standardText: null,
    copyright: [],
    notice: null,
  }));
}

/** webpack's runtime (module loading, chunk loading) is written into the bundle by webpack itself. */
export function describeWebpackRuntime(
  version: string,
  rootDir: string,
): ThirdPartyPackage {
  const require = createRequire(path.join(rootDir, 'package.json'));
  const folder = path.dirname(require.resolve('next/dist/compiled/webpack/package.json'));
  const entry = describePackage(
    { root: folder.replaceAll('\\', '/'), name: 'webpack', bundledIn: 'next' },
    [],
    rootDir,
  );
  return {
    ...entry,
    version,
    homepage: entry.homepage ?? 'https://github.com/webpack/webpack',
  };
}

// ---------------------------------------------------------------------------------------------
// The webpack plugin
// ---------------------------------------------------------------------------------------------

/** The few webpack types used here; next/dist/compiled/webpack only types them as any. */
interface Source {
  source(): string | Buffer;
}
interface Module {
  nameForCondition?(): string | null | undefined;
  /** A ConcatenatedModule's parts. */
  modules?: Iterable<Module>;
}
interface Compilation {
  chunks: Iterable<unknown>;
  chunkGraph: {
    getChunkModulesIterable(chunk: unknown): Iterable<Module>;
    getChunkRuntimeModulesIterable(chunk: unknown): Iterable<unknown>;
  };
  errors: unknown[];
  hooks: {
    processAssets: {
      tap(options: { name: string; stage: number }, run: () => void): void;
    };
  };
  getAssets(): ReadonlyArray<{ name: string; source: Source }>;
  emitAsset(name: string, source: Source): void;
  updateAsset(name: string, update: (source: Source) => Source): void;
}
export interface Compiler {
  webpack: {
    version: string;
    Compilation: { PROCESS_ASSETS_STAGE_REPORT: number };
    sources: {
      RawSource: new (source: string) => Source;
      ConcatSource: new (...parts: Array<string | Source>) => Source;
    };
    WebpackError: new (message: string) => Error;
  };
  hooks: {
    thisCompilation: { tap(name: string, run: (compilation: Compilation) => void): void };
  };
}

/** Every file a module stands for, opening concatenated modules. */
function moduleFiles(bundled: Module, into: Set<string>) {
  if (bundled.modules) {
    for (const inner of bundled.modules) moduleFiles(inner, into);
    return;
  }
  const file = bundled.nameForCondition?.();
  if (file) into.add(file);
}

export class ThirdPartyLicensesPlugin {
  constructor(private readonly options: { rootDir: string; bannerUrl: string }) {}

  apply(compiler: Compiler) {
    const { webpack } = compiler;
    const name = 'ThirdPartyLicensesPlugin';
    const banner = licenseBanner(this.options.bannerUrl);
    compiler.hooks.thisCompilation.tap(name, (compilation) => {
      // REPORT is the last stage: the chunks are final and minification is done, so the banner stays.
      compilation.hooks.processAssets.tap(
        { name, stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          try {
            const report = this.collect(compilation, webpack.version);
            compilation.emitAsset(
              THIRD_PARTY_LICENSES_FILE,
              new webpack.sources.RawSource(`${JSON.stringify(report, null, 2)}\n`),
            );
          } catch (error) {
            compilation.errors.push(
              new webpack.WebpackError(
                `${name}: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
          }
          for (const asset of compilation.getAssets()) {
            if (!asset.name.endsWith('.js')) continue;
            compilation.updateAsset(
              asset.name,
              (source) => new webpack.sources.ConcatSource(banner, '\n', source),
            );
          }
        },
      );
    });
  }

  private collect(
    compilation: Compilation,
    webpackVersion: string,
  ): ThirdPartyLicenseReport {
    const { rootDir } = this.options;
    const files = new Set<string>();
    let hasRuntime = false;
    for (const chunk of compilation.chunks) {
      for (const bundled of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
        moduleFiles(bundled, files);
      }
      const runtime = compilation.chunkGraph.getChunkRuntimeModulesIterable(chunk);
      if (!runtime[Symbol.iterator]().next().done) hasRuntime = true;
    }

    const byRoot = new Map<string, { location: PackageLocation; files: string[] }>();
    for (const file of [...files].sort()) {
      const location = packageForPath(file);
      if (!location) continue;
      const group = byRoot.get(location.root) ?? { location, files: [] };
      group.files.push(file);
      byRoot.set(location.root, group);
    }

    const packages: ThirdPartyPackage[] = [];
    const problems: string[] = [];
    for (const { location, files: packageFiles } of byRoot.values()) {
      try {
        packages.push(describePackage(location, packageFiles, rootDir));
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }
    try {
      if (hasRuntime) packages.push(describeWebpackRuntime(webpackVersion, rootDir));
      const polyfills = compilation
        .getAssets()
        .find((asset) => NEXT_POLYFILLS.asset.test(asset.name));
      if (polyfills) {
        packages.push(
          ...describeNextPolyfills(polyfills.source.source().toString(), rootDir),
        );
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
    if (problems.length) throw new Error(problems.join('\n'));
    return { generatedAt: new Date().toISOString(), packages: sortPackages(packages) };
  }
}
