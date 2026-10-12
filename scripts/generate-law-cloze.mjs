import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { topics } from './law-cloze-topics.mjs';

const source = JSON.parse(await readFile('ref/law-cloze/design-construction-snapshot.json', 'utf8'));
const evidence = JSON.parse(await readFile('ref/law-cloze/past-paper-evidence.json', 'utf8'));
const supplements = JSON.parse(await readFile('ref/law-cloze/article-supplements.json', 'utf8'));
const questions = topics.map(([id, category, title, articleNumber, starts, definitions, pattern]) => {
  const article = source.articles.find((item) => item.number === articleNumber);
  if (!article || articleNumber === '301') throw new Error('Invalid article: ' + articleNumber);
  const lines = article.text.split('\n');
  const selected = starts.map((prefix) => {
    const matches = lines.filter((line) => line.startsWith(prefix));
    if (matches.length !== 1) throw new Error('Ambiguous excerpt: ' + id + ' / ' + prefix);
    return { prefix, text: matches[0] };
  });
  const blanks = definitions.map(([prefix, text, answer, label, unit], index) => {
    const line = selected.find((item) => item.prefix === prefix);
    if (!line?.text.includes(text)) throw new Error('Numeral missing: ' + id + ' / ' + text);
    // Include units in the mask when a numeral contains one, e.g. 半小時.
    const replacement = '{{' + index + '}}' + (text.endsWith('小時') ? '小時' : text.endsWith('人') ? '人' : text.endsWith('輛') ? '輛' : '');
    // Repeated thresholds must not give away their own answer; single-character
    // numerals stay targeted to avoid masking unrelated clause numbers.
    line.text = text.length > 1 ? line.text.replaceAll(text, replacement) : line.text.replace(text, replacement);
    return { answer: text === '半小時' ? '半' : unit === '比值' ? answer.replace('/', ':') : answer, label, unit, original: text };
  });
  const matches = evidence.filter((q) => new RegExp(pattern).test(q.fineTopic + '\n' + q.text));
  if (!matches.length) throw new Error('No exam evidence: ' + id);
  const supplement = supplements[articleNumber];
  return { id, category, title, articleNumber, template: selected.map((item) => item.text).join('\n'), blanks, fullText: article.text + (supplement ? '\n\n' + supplement.text : ''), fullFileUrl: supplement?.sourceUrl ?? null, images: article.images ?? [], evidence: matches.map(({ id, year, number }) => ({ id, year, number })) };
});
await mkdir('src/features/law-cloze', { recursive: true });
await writeFile('src/features/law-cloze/bank.json', JSON.stringify({
  lawName: source.lawName, amendedOn: source.amendedOn, verifiedOn: source.verifiedOn,
  sourceUrl: source.sourceUrl, version: '1.66-2026-10-12',
  note: '以 115 年 2 月 23 日修正版、截至 115 年 10 月 12 日已施行條文出題。相關考古題數代表同題型線索，並非每題直接考本條；歷史試題答案仍依當年版本。',
  questions,
}, null, 2) + '\n');
console.log('Generated ' + questions.length + ' cloze questions; ' + questions.reduce((n,q)=>n+q.blanks.length,0) + ' numeric blanks.');
