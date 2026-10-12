import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const sourceUrl = 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070115';
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
if (!response.ok) throw new Error('Official law request failed');
const document = new JSDOM(await response.text()).window.document;
const articles = [...document.querySelectorAll('.law-article')].map((element) => {
  const label = element.closest('.row')?.querySelector('.col-no')?.textContent.trim();
  if (!label) throw new Error('Missing article number');
  const number = label.match(/第\s*([\d-]+)\s*條/)?.[1];
  if (!number) throw new Error('Invalid article number: ' + label);
  return {
    number, text: [...element.children].map((node) => node.textContent.trim()).join('\n'),
    images: [...element.querySelectorAll('img')].map((image) => ({
      url: new URL(image.getAttribute('src'), sourceUrl).href,
      alt: image.getAttribute('alt') || '官方附圖或附表',
    })),
  };
});
if (articles.length !== 389) throw new Error('Unexpected article count');
const version = document.querySelector('#trLNNDate')?.textContent.trim();
if (!version?.includes('115 年 02 月 23 日')) throw new Error('Review new law version: ' + version);
const questions = [];
const root = path.join('public', 'question-bank', '法規');
for (const year of (await readdir(root)).filter((value) => /^\d+$/.test(value)).sort()) {
  for (const number of (await readdir(path.join(root, year))).filter((value) => /^\d+$/.test(value)).sort()) {
    const directory = path.join(root, year, number);
    const meta = JSON.parse(await readFile(path.join(directory, 'meta.json'), 'utf8'));
    if (![meta.primaryCategory, ...(meta.categories ?? []), ...(meta.relatedLaws ?? [])].some((item) => item?.includes('建築技術規則'))) continue;
    const files = (await readdir(directory)).filter((name) => /^(question-\d+|[A-D])\.txt$/.test(name)).sort();
    const text = (await Promise.all(files.map((file) => readFile(path.join(directory, file), 'utf8')))).join('\n');
    questions.push({ id: 'law-' + year + '-' + number, year: Number(year), number: Number(number), fineTopic: meta.fineTopic ?? '', text });
  }
}
await mkdir('ref/law-cloze', { recursive: true });
await writeFile('ref/law-cloze/design-construction-snapshot.json', JSON.stringify({ lawName: '建築技術規則建築設計施工編', sourceUrl, amendedOn: '2026-02-23', verifiedOn: '2026-10-12', effectiveNote: '第 140～142、144 條自 115 年 7 月 1 日施行；第 301 條施行日期另定，試作不出題。', articles }, null, 2) + '\n');
await writeFile('ref/law-cloze/past-paper-evidence.json', JSON.stringify(questions, null, 2) + '\n');
console.log('Captured articles=' + articles.length + ', characters=' + articles.reduce((n, a) => n + a.text.length, 0) + ', questions=' + questions.length);
const counts = new Map();
for (const q of questions) counts.set(q.fineTopic, (counts.get(q.fineTopic) ?? 0) + 1);
console.log([...counts].sort((a,b)=>b[1]-a[1]).slice(0,40));
