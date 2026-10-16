/** Optional local QA. Never copies proprietary font files into public assets. */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createDailyPracticeSession } from '../src/features/daily/daily-practice';
import { createDailyPaper } from '../src/features/daily/daily-paper';
import { generateDailyPaperPdf } from '../src/features/daily/daily-paper-pdf';
import type { Question } from '../src/lib/types';

async function main() {
  const bank: Question[] = [{
    id: 'law-font-proof', subject: 'law', year: 110, questionNumber: 30,
    topic: '字型檢查', primaryCategory: '測試', tags: [], text: '字型與數字驗證',
    content: [{ kind: 'text', text: '中文字型與數字驗證：新細明體；1234567890、1/8、0.125、100 m²；ϕ∙⋅倂槪。' }],
    options: ['一', '二', '三', '四'], answerKey: { kind: 'accepted', options: [0] }, source: { kind: 'sample' },
  }];
  const session = createDailyPracticeSession(bank, ['law'], '2026-10-16', () => .5, 'normal');
  const paper = createDailyPaper(session, new Map(bank.map(q => [q.id, q])));
  const assets = { font: new Uint8Array(await readFile('public/fonts/daily-paper/paper-ming.ttf')),
    latinFont: new Uint8Array(await readFile('public/fonts/daily-paper/paper-times.ttf')),
    image: async () => { throw new Error('This proof contains no images'); } };
  await mkdir('test-results/font-proof', { recursive: true });
  await writeFile('test-results/font-proof/fallback.pdf', await generateDailyPaperPdf(paper, assets));
  if (existsSync('C:/Windows/Fonts/mingliu.ttc') && existsSync('C:/Windows/Fonts/times.ttf')) {
    await writeFile('test-results/font-proof/local.pdf', await generateDailyPaperPdf(paper, { ...assets, localFonts: {
      chinese: new Uint8Array(await readFile('C:/Windows/Fonts/mingliu.ttc')),
      latin: new Uint8Array(await readFile('C:/Windows/Fonts/times.ttf')),
    } }));
  }
}
void main();
