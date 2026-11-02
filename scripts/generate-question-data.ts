import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { subjects, years } from '@/question-bank/catalog';
import {
  assertRefsMatch,
  buildFacets,
  buildPaperIndex,
  buildSimilarFiles,
  buildStems,
} from '@/question-bank/derived-data';
import { MEMORY_GALLERY_CATEGORIES } from '@/lib/memory-gallery';
import { examsHref, examsSlugs } from '@/lib/question-path';
import { SITE_URL } from '@/lib/site';
import { loadSubjectQuestions } from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

const outputRoot = path.join(process.cwd(), 'public', 'question-data');
const sitemapFile = path.join(process.cwd(), 'public', 'sitemap.xml');

/** The public pages besides 考古題討論版's; everything personal is left to robots.txt. */
const publicPages = [
  '/',
  '/community',
  '/exams',
  '/practice',
  '/practice/law-cloze',
  '/privacy',
  '/resources',
  '/resources/analysis',
  '/resources/laws',
  '/resources/memory-gallery',
  ...MEMORY_GALLERY_CATEGORIES.slice(1).map(
    (category) => `/resources/memory-gallery/${category.id}`,
  ),
];

function sitemapOf(paths: readonly string[]) {
  const urls = paths.map((page) => `  <url><loc>${SITE_URL}${page}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

async function main() {
  const hash = createHash('sha256');
  let fileCount = 0;

  async function write(relativePath: string, value: unknown) {
    const text = JSON.stringify(value);
    hash.update(relativePath).update(text);
    fileCount += 1;
    const filePath = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, text, 'utf8');
  }

  // A topic that left the bank must not stay on the CDN as a stale file.
  await rm(path.join(outputRoot, 'law', 'similar'), { recursive: true, force: true });

  const bank: Question[] = [];
  for (const subject of subjects) {
    const questions: Question[] = [];
    for (const year of years) {
      const paper = await loadSubjectQuestions(subject.id, year);
      await write(path.join(subject.id, `${year}.json`), paper);
      questions.push(...paper);
    }
    await write(path.join(subject.id, 'facets.json'), buildFacets(questions));
    await write(path.join(subject.id, 'stems.json'), buildStems(questions));
    bank.push(...questions);
  }
  assertRefsMatch(buildPaperIndex(bank), bank);

  const similar = buildSimilarFiles(bank.filter((question) => question.subject === 'law'));
  for (const [key, rows] of similar) {
    await write(path.join('law', 'similar', `${key}.json`), rows);
  }

  await writeFile(
    sitemapFile,
    sitemapOf([...publicPages, ...examsSlugs(bank).map(examsHref)]),
  );

  // next.config.ts reads this: it versions every question-data URL of the build.
  await writeFile(path.join(outputRoot, 'version.txt'), hash.digest('hex').slice(0, 12));

  console.log(`Generated ${fileCount} question data files.`);
}

void main();
