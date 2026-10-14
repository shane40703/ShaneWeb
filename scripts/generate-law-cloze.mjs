import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { topics } from './law-cloze-topics.mjs';
import { designConstructionTopics } from './design-construction-cloze-topics.mjs';
import { accessibilityTopics } from './accessibility-cloze-topics.mjs';
import { coreLawTopics } from './core-law-cloze-topics.mjs';
import { maskReviewedExcerpts } from './cloze-excerpts.mjs';

const source = JSON.parse(await readFile('ref/law-cloze/design-construction-snapshot.json', 'utf8'));
const evidence = JSON.parse(await readFile('ref/law-cloze/past-paper-evidence.json', 'utf8'));
const supplements = JSON.parse(await readFile('ref/law-cloze/article-supplements.json', 'utf8'));
const questions = [...topics, ...designConstructionTopics].map(([id, category, title, articleNumber, starts, definitions, pattern]) => {
  const article = source.articles.find((item) => item.number === articleNumber);
  if (!article || articleNumber === '301') throw new Error('Invalid article: ' + articleNumber);
  const lines = article.text.split('\n');
  const selected = starts.map((prefix) => {
    const matches = lines.filter((line) => line.startsWith(prefix));
    if (matches.length !== 1) throw new Error('Ambiguous excerpt: ' + id + ' / ' + prefix);
    return { prefix, text: matches[0] };
  }).sort((a, b) => lines.indexOf(a.text) - lines.indexOf(b.text));
  const excerpt = maskReviewedExcerpts(selected, definitions, article.text);
  const matches = evidence.filter((q) => new RegExp(pattern).test(q.fineTopic + '\n' + q.text));
  if (!matches.length) throw new Error('No exam evidence: ' + id);
  const supplement = supplements[articleNumber];
  return { id, lawId: 'design-construction', category, title, articleNumber, articleLabel: '第 ' + articleNumber + ' 條', ...excerpt, fullText: article.text + (supplement ? '\n\n' + supplement.text : ''), sourceUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=' + articleNumber, fullFileUrl: supplement?.sourceUrl ?? null, images: article.images ?? [], evidence: matches.map(({ id, year, number }) => ({ id, year, number })) };
});
const accessibility = JSON.parse(await readFile('ref/law-cloze/accessibility-source.json', 'utf8'));
const provisions = JSON.parse(await readFile('ref/law-cloze/accessibility-provisions.json', 'utf8'));
const accessibilityEvidence = JSON.parse(await readFile('ref/law-cloze/accessibility-evidence.json', 'utf8'));
const tables = JSON.parse(await readFile('ref/law-cloze/accessibility-supplements.json', 'utf8'));
const pdfUrl = accessibility.files.find((file) => file.name === 'accessibility-current.pdf').url;
for (const [id, category, title, codes, definitions, pattern] of accessibilityTopics) {
  const selected = codes.map((code) => {
    const matches = provisions.filter((p) => p.number === code);
    if (matches.length !== 1) throw new Error('Ambiguous provision: ' + code);
    const provision = matches[0];
    const table = tables[code];
    if (table && !provision.text.endsWith(table.rawTable)) throw new Error('Review changed table: ' + code);
    const text = table ? provision.text.slice(0, -table.rawTable.length) + table.text : provision.text;
    return { prefix: code, text, page: provision.page };
  });
  const fullText = selected.map((line) => line.text).join('\n');
  const matches = accessibilityEvidence.filter((q) => new RegExp(pattern).test(q.fineTopic + '\n' + q.text));
  if (!matches.length) throw new Error('No exam evidence: ' + id);
  questions.push({ id, lawId: 'accessibility', category, title, articleNumber: codes.join('、'), articleLabel: '規範 ' + codes.join('、'), ...maskReviewedExcerpts(selected, definitions, fullText), fullText, sourceUrl: pdfUrl + '#page=' + selected[0].page, fullFileUrl: pdfUrl, images: [], evidence: matches.map(({ id, year, number }) => ({ id, year, number })) });
}
const coreSources = JSON.parse(await readFile('ref/law-cloze/core-laws-snapshot.json', 'utf8'));
const coreEvidence = JSON.parse(await readFile('ref/law-cloze/core-laws-evidence.json', 'utf8'));
for (const topic of coreLawTopics) {
  const law = coreSources.find((l) => l.id === topic.lawId);
  const article = law.articles.find((item) => item.number === topic.article);
  if (!article || article.text === '（刪除）') throw new Error('Invalid core article: ' + topic.id);
  const lines = article.text.split('\n');
  const selected = topic.starts.map((prefix) => {
    const matches = lines.filter((line) => line.startsWith(prefix));
    if (matches.length !== 1) throw new Error('Ambiguous core excerpt: ' + topic.id + ' / ' + prefix);
    return { prefix, text: matches[0] };
  }).sort((a, b) => lines.indexOf(a.text) - lines.indexOf(b.text));
  const matches = coreEvidence.filter((q) => q.lawIds.includes(law.id) && new RegExp(topic.pattern).test(q.fineTopic + '\n' + q.text));
  if (!matches.length) throw new Error('No related past-paper topic: ' + topic.id);
  questions.push({ id: topic.id, lawId: law.id, category: topic.category, title: topic.title, articleNumber: article.number, articleLabel: '第 ' + article.number + ' 條', ...maskReviewedExcerpts(selected, topic.definitions, article.text), fullText: article.text, sourceUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=' + law.code + '&flno=' + article.number, fullFileUrl: null, images: [], evidenceKind: topic.evidenceKind, evidence: matches.map(({ id, year, number }) => ({ id, year, number })) });
}
await mkdir('src/features/law-cloze', { recursive: true });
await writeFile('src/features/law-cloze/bank.json', JSON.stringify({
  version: '1.68-2026-10-14',
  legacyVersion: '1.67-2026-10-12',
  legacyQuestionIds: [...topics.map((q) => q[0]), ...accessibilityTopics.map((q) => q[0])],
  compatibleVersions: [
    { version: '1.67-2026-10-12', questionIds: [...topics.map((q) => q[0]), ...accessibilityTopics.map((q) => q[0])] },
    { version: '1.67-expanded-2026-10-12', questionIds: [...topics.map((q) => q[0]), ...designConstructionTopics.map((q) => q[0]), ...accessibilityTopics.map((q) => q[0])] },
  ],
  laws: [
    { id: 'design-construction', name: source.lawName, amendedOn: source.amendedOn, correctedOn: null, verifiedOn: source.verifiedOn, sourceUrl: source.sourceUrl, note: '115.02.23 修正；僅練習核對日已施行條文，第301條不出題。' },
    { id: 'accessibility', name: accessibility.lawName, amendedOn: accessibility.amendedOn, correctedOn: accessibility.correctedOn, verifiedOn: accessibility.verifiedOn, sourceUrl: accessibility.sourceUrl, note: '108.01.04 修正、108.07.01 施行，含109.05.11勘誤；參考附錄不作強制條文出題。' },
    ...coreSources.map((law) => ({ id: law.id, name: law.lawName, amendedOn: law.amendedOn, correctedOn: null, verifiedOn: law.verifiedOn, sourceUrl: law.sourceUrl, note: law.id === 'national-land-planning-act' ? '114.01.20 修正；第45條功能分區圖公告期限為地方國土計畫公告後十年，非舊版四年；土地使用罰則依分區管制啟動的適用條件閱讀。' : '採官方現行條文；保留期限起算、用途條件與但書；金額依條文原額及幣別，不換算或套用其他法規罰額。' })),
  ],
  note: '相關考古題數代表同題型線索，並非每題直接考本條；歷史試題答案仍依當年版本。',
  questions,
}, null, 2) + '\n');
console.log('Generated ' + questions.length + ' cloze questions; ' + questions.reduce((n,q)=>n+q.blanks.length,0) + ' numeric blanks.');
