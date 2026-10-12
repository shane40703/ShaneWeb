import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const sourceUrl = 'https://www.nlma.gov.tw/ch/legislation/regsearch/927';
// The official index is client-rendered. These are its reviewed latest/correction links.
// Recheck the index manually before updating these versioned PDF links.
const downloads = [
  ['https://www.nlma.gov.tw/uploads/files/e9abb44ff171074d23a7d1d5ee35b4a4.pdf', 'accessibility-current.pdf'],
  ['https://www.nlma.gov.tw/uploads/files/df0f22f7c943c902f0a5d4a7cc5c2046.pdf', 'accessibility-corrections.pdf'],
];
await mkdir('ref/law-cloze', { recursive: true });
const files = [];
const reviewedHashes = {
  'accessibility-current.pdf': '1ff0c1cc4cb27c6f74219bfb0d264cac056f88fe9109e36031c53cd6358c0245',
  'accessibility-corrections.pdf': '57f0d98045450d9c451a05878c66b2f83971c82964c658c09d9f841dac048e1b',
};
for (const [url, name] of downloads) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error('Official PDF request failed');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('Invalid PDF');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (sha256 !== reviewedHashes[name]) throw new Error('Official PDF changed; review new version before replacing snapshots: ' + name);
  await writeFile('ref/law-cloze/' + name, buffer);
  files.push({ name, url, bytes: buffer.length, sha256 });
}
await writeFile('ref/law-cloze/accessibility-source.json', JSON.stringify({
  lawName: '建築物無障礙設施設計規範', sourceUrl, amendedOn: '2019-01-04',
  effectiveOn: '2019-07-01', correctedOn: '2020-05-11', verifiedOn: '2026-10-12', files,
}, null, 2) + '\n');
const result = spawnSync('python', ['scripts/extract-accessibility.py'], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr);
console.log(result.stdout.trim());
const questions = [];
const root = path.join('public', 'question-bank', '法規');
for (const year of (await readdir(root)).filter((value) => /^\d+$/.test(value)).sort()) {
  for (const number of (await readdir(path.join(root, year))).filter((value) => /^\d+$/.test(value)).sort()) {
    const directory = path.join(root, year, number);
    const meta = JSON.parse(await readFile(path.join(directory, 'meta.json'), 'utf8'));
    const files = (await readdir(directory)).filter((name) => /^(question-\d+|[A-D])\.txt$/.test(name)).sort();
    const text = (await Promise.all(files.map((file) => readFile(path.join(directory, file), 'utf8')))).join('\n');
    if (!([meta.primaryCategory, ...(meta.categories ?? []), ...(meta.relatedLaws ?? []), text].some((v) => v?.includes('無障礙')))) continue;
    questions.push({ id: 'law-' + year + '-' + number, year: Number(year), number: Number(number), fineTopic: meta.fineTopic ?? '', text });
  }
}
await writeFile('ref/law-cloze/accessibility-evidence.json', JSON.stringify(questions, null, 2) + '\n');
console.log('Official PDF files:', files.map(({ name, bytes }) => ({ name, bytes })), '; related questions:', questions.length);
