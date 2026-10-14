import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const laws = [
  ['condominium-act', '公寓大廈管理條例', 'D0070118', '111 年 05 月 11 日', '2022-05-11'],
  ['nonurban-land-rules', '非都市土地使用管制規則', 'D0060013', '115 年 05 月 27 日', '2026-05-27'],
  ['procurement-act', '政府採購法', 'A0030057', '108 年 05 月 22 日', '2019-05-22'],
  ['construction-industry-act', '營造業法', 'D0070110', '108 年 06 月 19 日', '2019-06-19'],
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
  const attachments = [...document.querySelectorAll('a')].filter((a) => a.href.includes('LawGetFile')).map((a) => ({ title: a.textContent.trim(), url: new URL(a.getAttribute('href'), sourceUrl).href }));
  return { id, lawName, code, sourceUrl, amendedOn, verifiedOn: '2026-10-14', attachments, articles };
}));
const evidence = [];
const root = path.join('public', 'question-bank', '法規');
for (const year of (await readdir(root)).filter((value) => /^\d+$/.test(value)).sort()) {
  for (const number of (await readdir(path.join(root, year))).filter((value) => /^\d+$/.test(value)).sort()) {
    const directory = path.join(root, year, number);
    const meta = JSON.parse(await readFile(path.join(directory, 'meta.json'), 'utf8'));
    const files = (await readdir(directory)).filter((name) => /^(question-\d+|[A-D])\.txt$/.test(name)).sort();
    const text = (await Promise.all(files.map((file) => readFile(path.join(directory, file), 'utf8')))).join('\n');
    const tags = [meta.primaryCategory, ...(meta.categories ?? []), ...(meta.relatedLaws ?? [])].filter(Boolean);
    const lawIds = snapshots.filter((law) => tags.includes(law.lawName) || text.includes(law.lawName)).map((law) => law.id);
    if (lawIds.length) evidence.push({ id: 'law-' + year + '-' + number, year: Number(year), number: Number(number), lawIds, fineTopic: meta.fineTopic ?? '', text });
  }
}
await writeFile('ref/law-cloze/additional-laws-snapshot.json', JSON.stringify(snapshots, null, 2) + '\n');
await writeFile('ref/law-cloze/additional-laws-evidence.json', JSON.stringify(evidence, null, 2) + '\n');
for (const law of snapshots) console.log(law.lawName + ': ' + law.articles.length + ' articles; ' + evidence.filter((q) => q.lawIds.includes(law.id)).length + ' related past papers');
