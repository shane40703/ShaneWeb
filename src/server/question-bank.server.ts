import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StaticImageData } from 'next/image';
import { subjects } from '@/question-bank/catalog';
import {
  answerLabels,
  type AnswerLabel,
  type PaperMeta,
  type QuestionProvenance,
  type SourceAnswerKey,
  type SubjectId,
} from '@/question-bank/schema';
import {
  paperRegistry,
  questionRegistry,
  type QuestionRegistryEntry,
} from '@/question-bank/registry';
import { questionPath } from '@/lib/question-path';
import type { Question, QuestionSummary } from '@/lib/types';

const bankRoot = path.join(process.cwd(), 'src/question-bank');
const questionFilePattern = /^question-(\d{2})\.(txt|png|jpe?g|webp)$/;
const subjectOrder = new Map(subjects.map((subject, index) => [subject.id, index]));

interface RuntimeQuestionMeta {
  subject: SubjectId;
  primaryCategory: string;
  topic: string;
  tags: readonly string[];
  relatedLaws?: readonly string[];
  answerKey: SourceAnswerKey;
  provenance: QuestionProvenance;
  images?: Readonly<Record<string, { src: StaticImageData; alt: string }>>;
}

function fail(filePath: string, message: string): never {
  throw new Error(`${path.relative(process.cwd(), filePath)}: ${message}`);
}

function sortedRegistry() {
  return [...questionRegistry].sort(
    (left, right) =>
      (subjectOrder.get(left.subject) ?? 99) - (subjectOrder.get(right.subject) ?? 99) ||
      right.year - left.year ||
      left.questionNumber - right.questionNumber,
  );
}

function questionId(entry: QuestionRegistryEntry) {
  return `${entry.subject}-${entry.year}-${String(entry.questionNumber).padStart(2, '0')}`;
}

function questionDirectory(entry: QuestionRegistryEntry) {
  return path.join(
    bankRoot,
    entry.subject,
    String(entry.year),
    String(entry.questionNumber).padStart(2, '0'),
  );
}

async function readRequiredText(filePath: string) {
  let value: string;
  try {
    value = await readFile(filePath, 'utf8');
  } catch {
    fail(filePath, 'required UTF-8 text file is missing');
  }
  const normalized = value.trim();
  if (!normalized) fail(filePath, 'text file must not be empty');
  return normalized;
}

function runtimeAnswerKey(answerKey: SourceAnswerKey) {
  if (answerKey.kind === 'all-credit') return { kind: 'all-credit' as const };
  const indexes = answerKey.options.map((answer) => answerLabels.indexOf(answer));
  if (!indexes.length || indexes.some((index) => index < 0)) {
    throw new Error('answerKey must contain at least one valid answer');
  }
  if (new Set(indexes).size !== indexes.length) {
    throw new Error('answerKey must not contain duplicate answers');
  }
  return { kind: 'accepted' as const, options: indexes };
}

function findPaper(entry: QuestionRegistryEntry): PaperMeta | undefined {
  return paperRegistry.find(
    (paper) => paper.subject === entry.subject && paper.year === entry.year,
  )?.meta;
}

export function getQuestionSummaries(): QuestionSummary[] {
  return sortedRegistry().map((entry) => {
    const meta = entry.meta as RuntimeQuestionMeta;
    return {
      id: questionId(entry),
      subject: entry.subject,
      year: entry.year,
      questionNumber: entry.questionNumber,
      primaryCategory: meta.primaryCategory,
      topic: meta.topic,
      tags: meta.tags,
      path: questionPath(entry.subject, entry.year, entry.questionNumber),
    };
  });
}

export function getQuestionStaticPaths() {
  return sortedRegistry().map((entry) => ({
    params: {
      subject: entry.subject,
      year: String(entry.year),
      number: String(entry.questionNumber).padStart(2, '0'),
    },
  }));
}

export function findQuestionEntry(
  subject: string,
  year: string,
  number: string,
) {
  return questionRegistry.find(
    (entry) =>
      entry.subject === subject &&
      entry.year === Number(year) &&
      entry.questionNumber === Number(number),
  );
}

export async function loadQuestion(entry: QuestionRegistryEntry): Promise<Question> {
  const directory = questionDirectory(entry);
  const metaPath = path.join(directory, 'meta.ts');
  const meta = entry.meta as RuntimeQuestionMeta;
  if (meta.subject !== entry.subject) {
    fail(metaPath, `subject ${meta.subject} does not match registry ${entry.subject}`);
  }

  const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const contentFiles = entries
    .filter((file) => file.isFile())
    .map((file) => {
      const match = questionFilePattern.exec(file.name);
      return match
        ? { name: file.name, order: Number(match[1]), extension: match[2].toLowerCase() }
        : null;
    })
    .filter((file): file is NonNullable<typeof file> => Boolean(file))
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));

  if (!contentFiles.length) fail(directory, 'at least one question-NN.* file is required');
  for (let index = 1; index < contentFiles.length; index += 1) {
    if (contentFiles[index - 1].order === contentFiles[index].order) {
      fail(directory, `question order ${contentFiles[index].order} is duplicated`);
    }
  }

  const allowedNames = new Set([
    'meta.ts',
    ...answerLabels.map((answer) => `${answer}.txt`),
    'explanation.txt',
    ...contentFiles.map((file) => file.name),
  ]);
  for (const file of entries) {
    if (file.isFile() && file.name !== '.DS_Store' && !allowedNames.has(file.name)) {
      fail(path.join(directory, file.name), 'unexpected file in question directory');
    }
  }

  const options = await Promise.all(
    answerLabels.map((answer: AnswerLabel) =>
      readRequiredText(path.join(directory, `${answer}.txt`)),
    ),
  );
  const content: Question['content'][number][] = [];
  const plainText: string[] = [];
  const usedImages = new Set<string>();

  for (const file of contentFiles) {
    if (file.extension === 'txt') {
      const text = await readRequiredText(path.join(directory, file.name));
      plainText.push(text);
      content.push({ kind: 'text', text });
      continue;
    }
    const image = meta.images?.[file.name];
    if (!image?.alt.trim()) fail(metaPath, `images entry is required for ${file.name}`);
    usedImages.add(file.name);
    content.push({ kind: 'image', src: image.src, alt: image.alt.trim() });
  }

  for (const declaredImage of Object.keys(meta.images ?? {})) {
    if (!usedImages.has(declaredImage)) fail(metaPath, `images references missing ${declaredImage}`);
  }

  let explanation: string | undefined;
  try {
    explanation = (await readFile(path.join(directory, 'explanation.txt'), 'utf8')).trim();
    if (!explanation) fail(directory, 'explanation.txt must not be empty when present');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const paper = findPaper(entry);
  if (meta.provenance.kind === 'official' && !paper) {
    fail(metaPath, 'official questions require a registered paper.ts');
  }
  const source: Question['source'] =
    meta.provenance.kind === 'official' && paper
      ? {
          kind: 'official',
          paperCode: paper.paperCode,
          page: meta.provenance.page,
          questionUrl: paper.questionUrl,
          answerUrl: paper.answerUrl,
          ...(paper.correctionUrl ? { correctionUrl: paper.correctionUrl } : {}),
        }
      : { kind: 'sample' };

  return {
    id: questionId(entry),
    year: entry.year,
    subject: entry.subject,
    questionNumber: entry.questionNumber,
    topic: meta.topic,
    primaryCategory: meta.primaryCategory,
    tags: meta.tags,
    ...(meta.relatedLaws?.length ? { relatedLaws: meta.relatedLaws } : {}),
    text: plainText.join('\n\n'),
    content,
    options,
    answerKey: runtimeAnswerKey(meta.answerKey),
    ...(explanation ? { explanation } : {}),
    source,
  };
}

export async function loadAllQuestions() {
  return Promise.all(sortedRegistry().map((entry) => loadQuestion(entry)));
}
