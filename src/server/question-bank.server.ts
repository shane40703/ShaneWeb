import { readdir, readFile, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { subjects } from '@/question-bank/catalog';
import {
  answerLabels,
  categoryCatalog,
  type AnswerLabel,
  type PaperMeta,
  type QuestionProvenance,
  type SourceAnswerKey,
  type SubjectId,
} from '@/question-bank/schema';
import { questionPath } from '@/lib/question-path';
import { toQuizQuestion } from '@/lib/study';
import type { Question, QuestionSummary, QuizQuestion } from '@/lib/types';

const bankRoot = path.join(process.cwd(), 'public/question-bank');
const yearDirectoryPattern = /^\d{3}$/;
const questionDirectoryPattern = /^\d{2}$/;
const questionFilePattern = /^question-(\d{2})\.(txt|png|jpe?g|webp)$/;
const questionImageFilePattern = /^question-\d{2}\.(png|jpe?g|webp)$/;
const privateUseCharacterPattern = /[\uE000-\uF8FF]/u;
const subjectOrder = new Map(subjects.map((subject, index) => [subject.id, index]));

/** Filesystem noise that must never be mistaken for question bank content. */
const ignoredEntryNames = new Set(['.DS_Store', 'Thumbs.db']);

function bankEntries(entries: readonly Dirent[]) {
  return entries.filter((entry) => !ignoredEntryNames.has(entry.name));
}

interface RuntimeQuestionMeta {
  primaryCategory: string;
  topic: string;
  tags: readonly string[];
  relatedLaws?: readonly string[];
  answerKey: SourceAnswerKey;
  provenance: QuestionProvenance;
  images?: Readonly<Record<string, { alt: string }>>;
}

interface QuestionEntry {
  subject: SubjectId;
  subjectDirectory: string;
  year: number;
  questionNumber: number;
  directory: string;
  meta: RuntimeQuestionMeta;
  paper?: PaperMeta;
}

function fail(filePath: string, message: string): never {
  throw new Error(`${path.relative(process.cwd(), filePath)}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectValue(filePath: string, value: unknown, label: string) {
  if (!isRecord(value)) fail(filePath, `${label} must be an object`);
  return value;
}

function validateKeys(
  filePath: string,
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
) {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected) fail(filePath, `unexpected property ${unexpected}`);
  const missing = required.find((key) => !(key in value));
  if (missing) fail(filePath, `required property ${missing} is missing`);
}

function stringValue(filePath: string, value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(filePath, `${label} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(filePath: string, value: unknown, label: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    fail(filePath, `${label} must be a positive integer`);
  }
  return Number(value);
}

function stringArray(filePath: string, value: unknown, label: string) {
  if (!Array.isArray(value)) fail(filePath, `${label} must be an array`);
  const strings = value.map((item, index) =>
    stringValue(filePath, item, `${label}[${index}]`),
  );
  if (new Set(strings).size !== strings.length) {
    fail(filePath, `${label} must not contain duplicates`);
  }
  return strings;
}

function parseAnswerKey(filePath: string, value: unknown): SourceAnswerKey {
  const answerKey = objectValue(filePath, value, 'answerKey');
  const kind = stringValue(filePath, answerKey.kind, 'answerKey.kind');
  if (kind === 'all-credit') {
    validateKeys(filePath, answerKey, ['kind'], ['kind']);
    return { kind };
  }
  if (kind !== 'accepted')
    fail(filePath, 'answerKey.kind must be accepted or all-credit');
  validateKeys(filePath, answerKey, ['kind', 'options'], ['kind', 'options']);
  const options = stringArray(filePath, answerKey.options, 'answerKey.options');
  if (!options.length) fail(filePath, 'answerKey.options must not be empty');
  if (!options.every((option) => answerLabels.includes(option as AnswerLabel))) {
    fail(filePath, 'answerKey.options must contain only A, B, C, or D');
  }
  return {
    kind,
    options: options as [AnswerLabel, ...AnswerLabel[]],
  };
}

function parseProvenance(filePath: string, value: unknown): QuestionProvenance {
  const provenance = objectValue(filePath, value, 'provenance');
  const kind = stringValue(filePath, provenance.kind, 'provenance.kind');
  if (kind === 'sample') {
    validateKeys(filePath, provenance, ['kind'], ['kind']);
    return { kind };
  }
  if (kind !== 'official') fail(filePath, 'provenance.kind must be sample or official');
  validateKeys(filePath, provenance, ['kind', 'page'], ['kind', 'page']);
  return { kind, page: positiveInteger(filePath, provenance.page, 'provenance.page') };
}

function parseImages(filePath: string, value: unknown) {
  if (value === undefined) return undefined;
  const imageValues = objectValue(filePath, value, 'images');
  const images: Record<string, { alt: string }> = {};
  for (const [fileName, imageValue] of Object.entries(imageValues)) {
    if (!questionImageFilePattern.test(fileName)) {
      fail(filePath, `images contains invalid filename ${fileName}`);
    }
    const image = objectValue(filePath, imageValue, `images.${fileName}`);
    validateKeys(filePath, image, ['alt'], ['alt']);
    images[fileName] = {
      alt: stringValue(filePath, image.alt, `images.${fileName}.alt`),
    };
  }
  return images;
}

function parseQuestionMeta(
  filePath: string,
  value: unknown,
  subject: SubjectId,
): RuntimeQuestionMeta {
  const meta = objectValue(filePath, value, 'question metadata');
  validateKeys(
    filePath,
    meta,
    [
      'primaryCategory',
      'topic',
      'tags',
      'relatedLaws',
      'answerKey',
      'provenance',
      'images',
    ],
    ['primaryCategory', 'topic', 'tags', 'answerKey', 'provenance'],
  );

  const primaryCategory = stringValue(filePath, meta.primaryCategory, 'primaryCategory');
  const topic = stringValue(filePath, meta.topic, 'topic');
  const categories = categoryCatalog[subject] as Record<string, readonly string[]>;
  if (!Object.hasOwn(categories, primaryCategory)) {
    fail(filePath, `primaryCategory ${primaryCategory} is not valid for ${subject}`);
  }
  if (!categories[primaryCategory].includes(topic)) {
    fail(filePath, `topic ${topic} is not valid for primaryCategory ${primaryCategory}`);
  }

  const validTags = new Set(Object.values(categories).flat());
  const tags = stringArray(filePath, meta.tags, 'tags');
  if (tags.some((tag) => !validTags.has(tag))) {
    fail(filePath, `tags must contain only topics defined for ${subject}`);
  }

  return {
    primaryCategory,
    topic,
    tags,
    ...(meta.relatedLaws === undefined
      ? {}
      : { relatedLaws: stringArray(filePath, meta.relatedLaws, 'relatedLaws') }),
    answerKey: parseAnswerKey(filePath, meta.answerKey),
    provenance: parseProvenance(filePath, meta.provenance),
    ...(meta.images === undefined ? {} : { images: parseImages(filePath, meta.images) }),
  } satisfies RuntimeQuestionMeta;
}

function parseUrl(filePath: string, value: unknown, label: string) {
  const url = stringValue(filePath, value, label);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail(filePath, `${label} must be a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(filePath, `${label} must use http or https`);
  }
  return url;
}

function parsePaperMeta(filePath: string, value: unknown): PaperMeta {
  const paper = objectValue(filePath, value, 'paper metadata');
  validateKeys(
    filePath,
    paper,
    [
      'status',
      'paperCode',
      'officialName',
      'totalQuestions',
      'questionUrl',
      'answerUrl',
      'correctionUrl',
    ],
    ['status', 'paperCode', 'officialName', 'totalQuestions', 'questionUrl', 'answerUrl'],
  );
  const status = stringValue(filePath, paper.status, 'status');
  if (status !== 'official-partial' && status !== 'official-complete') {
    fail(filePath, 'status must be official-partial or official-complete');
  }
  return {
    status,
    paperCode: stringValue(filePath, paper.paperCode, 'paperCode'),
    officialName: stringValue(filePath, paper.officialName, 'officialName'),
    totalQuestions: positiveInteger(filePath, paper.totalQuestions, 'totalQuestions'),
    questionUrl: parseUrl(filePath, paper.questionUrl, 'questionUrl'),
    answerUrl: parseUrl(filePath, paper.answerUrl, 'answerUrl'),
    ...(paper.correctionUrl === undefined
      ? {}
      : { correctionUrl: parseUrl(filePath, paper.correctionUrl, 'correctionUrl') }),
  };
}

async function readJson(filePath: string) {
  let source: string;
  try {
    source = await readFile(filePath, 'utf8');
  } catch {
    fail(filePath, 'required UTF-8 JSON file is missing');
  }
  try {
    return JSON.parse(source) as unknown;
  } catch {
    fail(filePath, 'file must contain valid JSON');
  }
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
  const privateUseCharacter = normalized.match(privateUseCharacterPattern)?.[0];
  if (privateUseCharacter) {
    fail(
      filePath,
      `text file contains unsupported private-use character U+${privateUseCharacter
        .codePointAt(0)!
        .toString(16)
        .toUpperCase()}`,
    );
  }
  return normalized;
}

async function discoverYear(
  subject: SubjectId,
  subjectDirectory: string,
  yearEntryName: string,
): Promise<QuestionEntry[]> {
  const year = Number(yearEntryName);
  const yearDirectory = path.join(bankRoot, subjectDirectory, yearEntryName);
  if (year <= 0) fail(yearDirectory, 'year directory must be greater than zero');
  const entries = bankEntries(await readdir(yearDirectory, { withFileTypes: true }));
  let paper: PaperMeta | undefined;
  const paperEntry = entries.find(
    (entry) => entry.isFile() && entry.name === 'paper.json',
  );
  if (paperEntry) {
    const paperPath = path.join(yearDirectory, paperEntry.name);
    paper = parsePaperMeta(paperPath, await readJson(paperPath));
  }

  const questionDirectoryNames: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'paper.json') continue;
    if (entry.isDirectory() && entry.name === 'source') continue;
    if (entry.isDirectory() && questionDirectoryPattern.test(entry.name)) {
      questionDirectoryNames.push(entry.name);
      continue;
    }
    fail(path.join(yearDirectory, entry.name), 'unexpected entry in year directory');
  }

  const questions = await Promise.all(
    questionDirectoryNames.map(async (questionEntryName): Promise<QuestionEntry> => {
      const directory = path.join(yearDirectory, questionEntryName);
      const metaPath = path.join(directory, 'meta.json');
      const meta = parseQuestionMeta(metaPath, await readJson(metaPath), subject);
      if (meta.provenance.kind === 'official' && !paper) {
        fail(metaPath, 'official questions require paper.json in the year directory');
      }
      const questionNumber = Number(questionEntryName);
      if (questionNumber <= 0)
        fail(directory, 'question number must be greater than zero');
      if (paper && questionNumber > paper.totalQuestions) {
        fail(
          metaPath,
          `question number exceeds paper totalQuestions ${paper.totalQuestions}`,
        );
      }
      return {
        subject,
        subjectDirectory,
        year,
        questionNumber,
        directory,
        meta,
        ...(paper ? { paper } : {}),
      };
    }),
  );

  if (
    paper?.status === 'official-complete' &&
    questions.length !== paper.totalQuestions
  ) {
    fail(
      path.join(yearDirectory, 'paper.json'),
      `official-complete paper declares ${paper.totalQuestions} questions but found ${questions.length}`,
    );
  }
  return questions;
}

async function discoverQuestionEntries() {
  const rootEntries = bankEntries(await readdir(bankRoot, { withFileTypes: true }));
  const expectedDirectories = new Set<string>(
    subjects.map((subject) => subject.directory),
  );
  for (const entry of rootEntries) {
    if (!entry.isDirectory() || !expectedDirectories.has(entry.name)) {
      fail(path.join(bankRoot, entry.name), 'unexpected entry in question bank root');
    }
  }

  const questions = (
    await Promise.all(
      subjects.map(async (subject) => {
        const subjectDirectory = path.join(bankRoot, subject.directory);
        const entries = bankEntries(
          await readdir(subjectDirectory, { withFileTypes: true }),
        );
        const years: string[] = [];
        for (const entry of entries) {
          if (!entry.isDirectory() || !yearDirectoryPattern.test(entry.name)) {
            fail(
              path.join(subjectDirectory, entry.name),
              'expected a three-digit year directory',
            );
          }
          years.push(entry.name);
        }
        return (
          await Promise.all(
            years.map((year) => discoverYear(subject.id, subject.directory, year)),
          )
        ).flat();
      }),
    )
  ).flat();

  return questions.sort(
    (left, right) =>
      (subjectOrder.get(left.subject) ?? 99) - (subjectOrder.get(right.subject) ?? 99) ||
      right.year - left.year ||
      left.questionNumber - right.questionNumber,
  );
}

/**
 * Stats every bank file so `next dev` can reuse a parsed bank until something on
 * disk actually changes. Statting is orders of magnitude cheaper than re-reading
 * every option file and re-probing every image with sharp on each request.
 */
async function bankFingerprint() {
  const entries = bankEntries(
    await readdir(bankRoot, { recursive: true, withFileTypes: true }),
  ).filter((entry) => entry.isFile());
  const stamps = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(entry.parentPath, entry.name);
      const { mtimeMs, size } = await stat(filePath);
      return `${filePath}:${mtimeMs}:${size}`;
    }),
  );
  return stamps.sort().join('|');
}

interface BankCache {
  fingerprint: string;
  entries: Promise<QuestionEntry[]>;
  summaries?: Promise<QuestionSummary[]>;
}

const watchesQuestionBank = process.env.NODE_ENV === 'development';
let bankCache: BankCache | undefined;

async function getBankCache(): Promise<BankCache> {
  if (!watchesQuestionBank) {
    bankCache ??= { fingerprint: '', entries: discoverQuestionEntries() };
    return bankCache;
  }
  const fingerprint = await bankFingerprint();
  if (bankCache?.fingerprint !== fingerprint) {
    bankCache = { fingerprint, entries: discoverQuestionEntries() };
  }
  return bankCache;
}

async function getQuestionEntries() {
  return (await getBankCache()).entries;
}

function questionId(entry: QuestionEntry) {
  return `${entry.subject}-${entry.year}-${String(entry.questionNumber).padStart(2, '0')}`;
}

function publicAssetPath(entry: QuestionEntry, fileName: string) {
  return `/${['question-bank', entry.subjectDirectory, String(entry.year), String(entry.questionNumber).padStart(2, '0'), fileName].join('/')}`;
}

function runtimeAnswerKey(answerKey: SourceAnswerKey) {
  if (answerKey.kind === 'all-credit') return { kind: 'all-credit' as const };
  return {
    kind: 'accepted' as const,
    options: answerKey.options.map((answer) => answerLabels.indexOf(answer)),
  };
}

async function discoverQuestionSummaries(
  entries: readonly QuestionEntry[],
): Promise<QuestionSummary[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const question = await loadQuestion(entry);
      return {
        id: question.id,
        subject: question.subject,
        year: question.year,
        questionNumber: question.questionNumber,
        primaryCategory: question.primaryCategory,
        topic: question.topic,
        tags: question.tags,
        ...(question.relatedLaws?.length ? { relatedLaws: question.relatedLaws } : {}),
        text: question.text,
        path: questionPath(entry.subject, entry.year, entry.questionNumber),
      };
    }),
  );
}

export async function getQuestionSummaries(): Promise<QuestionSummary[]> {
  const cache = await getBankCache();
  cache.summaries ??= cache.entries.then(discoverQuestionSummaries);
  return cache.summaries;
}

export async function getQuestionStaticPaths() {
  return (await getQuestionEntries()).map((entry) => ({
    params: {
      subject: entry.subject,
      year: String(entry.year),
      number: String(entry.questionNumber).padStart(2, '0'),
    },
  }));
}

export async function findQuestionEntry(subject: string, year: string, number: string) {
  return (await getQuestionEntries()).find(
    (entry) =>
      entry.subject === subject &&
      entry.year === Number(year) &&
      entry.questionNumber === Number(number),
  );
}

async function readImageDimensions(filePath: string) {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(filePath).metadata();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown image error';
    fail(filePath, `unable to read image metadata: ${message}`);
  }
  const { width, height } = metadata.autoOrient;
  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    fail(filePath, 'image must have valid intrinsic dimensions');
  }
  return { width, height };
}

export async function loadQuestion(entry: QuestionEntry): Promise<Question> {
  const { directory, meta } = entry;
  const metaPath = path.join(directory, 'meta.json');
  const entries = bankEntries(await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
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
    .sort(
      (left, right) => left.order - right.order || left.name.localeCompare(right.name),
    );

  if (!contentFiles.length)
    fail(directory, 'at least one question-NN.* file is required');
  for (let index = 1; index < contentFiles.length; index += 1) {
    if (contentFiles[index - 1].order === contentFiles[index].order) {
      fail(directory, `question order ${contentFiles[index].order} is duplicated`);
    }
  }

  const allowedNames = new Set([
    'meta.json',
    ...answerLabels.map((answer) => `${answer}.txt`),
    'explanation.txt',
    ...contentFiles.map((file) => file.name),
  ]);
  for (const file of entries) {
    if (!file.isFile() || !allowedNames.has(file.name)) {
      fail(path.join(directory, file.name), 'unexpected entry in question directory');
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
    const filePath = path.join(directory, file.name);
    if (file.extension === 'txt') {
      const text = await readRequiredText(filePath);
      plainText.push(text);
      content.push({ kind: 'text', text });
      continue;
    }
    const image = meta.images?.[file.name];
    if (!image) fail(metaPath, `images entry is required for ${file.name}`);
    usedImages.add(file.name);
    content.push({
      kind: 'image',
      src: publicAssetPath(entry, file.name),
      alt: image.alt,
      ...(await readImageDimensions(filePath)),
    });
  }

  for (const declaredImage of Object.keys(meta.images ?? {})) {
    if (!usedImages.has(declaredImage))
      fail(metaPath, `images references missing ${declaredImage}`);
  }

  let explanation: string | undefined;
  try {
    explanation = (
      await readFile(path.join(directory, 'explanation.txt'), 'utf8')
    ).trim();
    if (!explanation) fail(directory, 'explanation.txt must not be empty when present');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const source: Question['source'] =
    meta.provenance.kind === 'official' && entry.paper
      ? {
          kind: 'official',
          paperCode: entry.paper.paperCode,
          page: meta.provenance.page,
          questionUrl: entry.paper.questionUrl,
          answerUrl: entry.paper.answerUrl,
          ...(entry.paper.correctionUrl
            ? { correctionUrl: entry.paper.correctionUrl }
            : {}),
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
  return Promise.all((await getQuestionEntries()).map((entry) => loadQuestion(entry)));
}

export async function loadSubjectQuestions(subject: SubjectId): Promise<Question[]> {
  const entries = (await getQuestionEntries()).filter(
    (entry) => entry.subject === subject,
  );
  return Promise.all(entries.map((entry) => loadQuestion(entry)));
}

export async function loadQuizQuestions(
  subject: SubjectId,
  year?: number,
): Promise<QuizQuestion[]> {
  const entries = (await getQuestionEntries()).filter(
    (entry) => entry.subject === subject && (year === undefined || entry.year === year),
  );
  const questions = await Promise.all(entries.map((entry) => loadQuestion(entry)));
  return questions.map(toQuizQuestion);
}
