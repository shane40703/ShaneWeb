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
import { loadSubjectQuestions } from '@/server/question-bank.server';
import type { Question } from '@/lib/types';

const outputRoot = path.join(process.cwd(), 'public', 'question-data');

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

  // next.config.ts reads this: it versions every question-data URL of the build.
  await writeFile(path.join(outputRoot, 'version.txt'), hash.digest('hex').slice(0, 12));

  console.log(`Generated ${fileCount} question data files.`);
}

void main();
