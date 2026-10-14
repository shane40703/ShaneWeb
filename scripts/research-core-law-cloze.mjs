import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// Explicitly reviewed versions: stop rather than silently accepting a later amendment.
const laws = [
  ['building-act', '建築法', 'D0070109', '111 年 05 月 11 日', '2022-05-11'],
  ['architects-act', '建築師法', 'D0070112', '112 年 12 月 06 日', '2023-12-06'],
  ['urban-planning-act', '都市計畫法', 'D0070001', '110 年 05 月 26 日', '2021-05-26'],
  ['national-land-planning-act', '國土計畫法', 'D0070230', '114 年 01 月 20 日', '2025-01-20'],
];
const snapshots = await Promise.all(laws.map(async ([id, lawName, code, expectedDate, amendedOn]) => {
  const sourceUrl = 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=' + code;
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error('Official request failed: ' + lawName);
  const document = new JSDOM(await response.text()).window.document;
  const version = document.querySelector('#trLNNDate')?.textContent.trim();
  if (!version?.includes(expectedDate)) throw new Error('Review amended version: ' + lawName + ' / ' + version);
  const articles = [...document.querySelectorAll('.law-article')].map((element) => {
    const label = element.closest('.row')?.querySelector('.col-no')?.textContent.trim();
    const number = label?.match(/第\s*([\d-]+)\s*條/)?.[1];
    if (!number) throw new Error('Missing article number: ' + lawName);
    return { number, text: [...element.children].map((node) => node.textContent.trim()).join('\n') };
  });
  if (!articles.length) throw new Error('Empty official source: ' + lawName);
  return { id, lawName, code, sourceUrl, amendedOn, verifiedOn: '2026-10-14', articles };
}));

const questions = [];
const root = path.join('public', 'question-bank', '法規');
for (const year of (await readdir(root)).filter((value) => /^\d+$/.test(value)).sort()) {
  for (const number of (await readdir(path.join(root, year))).filter((value) => /^\d+$/.test(value)).sort()) {
    const directory = path.join(root, year, number);
    const meta = JSON.parse(await readFile(path.join(directory, 'meta.json'), 'utf8'));
    const files = (await readdir(directory)).filter((name) => /^(question-\d+|[A-D])\.txt$/.test(name)).sort();
    const text = (await Promise.all(files.map((file) => readFile(path.join(directory, file), 'utf8')))).join('\n');
    const tags = [meta.primaryCategory, ...(meta.categories ?? []), ...(meta.relatedLaws ?? [])].filter(Boolean);
    // Match explicit mentions/tags, not "建築法規" or sibling laws and enforcement rules alone.
    const lawIds = snapshots.filter((law) => tags.includes(law.lawName) || new RegExp(law.lawName + '(?!規)').test(text)).map((law) => law.id);
    if (lawIds.length) questions.push({ id: 'law-' + year + '-' + number, year: Number(year), number: Number(number), lawIds, fineTopic: meta.fineTopic ?? '', text });
  }
}
await writeFile('ref/law-cloze/core-laws-snapshot.json', JSON.stringify(snapshots, null, 2) + '\n');
await writeFile('ref/law-cloze/core-laws-evidence.json', JSON.stringify(questions, null, 2) + '\n');
for (const law of snapshots) {
  console.log(law.lawName + ': ' + law.articles.length + ' articles; ' + questions.filter((q) => q.lawIds.includes(law.id)).length + ' related past papers');
}
