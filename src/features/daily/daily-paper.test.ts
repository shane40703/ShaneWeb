// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFPage, PageSizes } from 'pdf-lib';
import type { Question } from '@/lib/types';
import { createPracticePaper, createPracticeSession } from '@/features/practice/practice-session';
import { dailyPaperFilename, DAILY_PAPER_TITLE, getTaipeiDateKey } from './daily-paper';
import { allowsDailyFontEmbedding, generateDailyPaperPdf, wrapPaperText } from './daily-paper-pdf';

const questions: Question[] = Array.from({ length: 74 }, (_, index) => ({
  id: `law-114-${index + 1}`, subject: 'law', year: 114, questionNumber: index + 1,
  topic: '法規', primaryCategory: '建築法', tags: [], text: `第 ${index + 1} 題題幹`,
  content: [{ kind: 'text', text: `第 ${index + 1} 題題幹\n保留單位：1/8、0.125、100 m²，不轉換數字。ϕ∙⋅倂槪` }],
  options: ['甲選項', '乙選項', '丙選項', '丁選項'], answerKey: { kind: 'accepted', options: [0] },
  explanation: '不可出現在試卷的私人詳解', source: { kind: 'sample' },
}));
const bank = new Map(questions.map(question => [question.id, question]));
/** 選擇題練習's paper, the only one left: `count` questions of law 114. */
function practicePaper(count = 50, date = '2026-10-15') {
  const session = createPracticeSession({ candidates: questions, count, rangeStart: 114, rangeEnd: 114, category: 'all' }, 'law', false, () => .5);
  return { session, paper: createPracticePaper(session, bank, date) };
}
async function fonts() {
  return { font: new Uint8Array(await readFile('public/fonts/daily-paper/paper-ming.ttf')),
    latinFont: new Uint8Array(await readFile('public/fonts/daily-paper/paper-times.ttf')) };
}

describe('daily paper snapshot', () => {
  it('retains the assigned order and shuffled options, remaps the separate key without changing session data', () => {
    const { session } = practicePaper();
    session.optionOrders[session.questionIds[0]] = [2, 0, 3, 1];
    session.answers[session.questionIds[0]] = { selected: 1, correct: true };
    const original = JSON.stringify(session);
    const paper = createPracticePaper(session, bank, '2026-10-15');
    expect(paper.questions.map(question => question.id)).toEqual(session.questionIds);
    expect(paper.questions[0].options).toEqual(['丙選項', '甲選項', '丁選項', '乙選項']);
    expect(paper.referenceAnswers[0]).toBe('B');
    expect(paper.questions).toHaveLength(50);
    expect(JSON.stringify(paper)).not.toContain('私人詳解');
    expect(paper.questions[0]).not.toHaveProperty('answerKey');
    expect(JSON.stringify(session)).toBe(original);
    expect(dailyPaperFilename(paper)).toBe('建築師每日練習-2026-10-15-建築法規與實務.pdf');
  });

  it('handles accepted alternatives and all-credit answers, and refuses a set that is not loaded', () => {
    const { session } = practicePaper(74);
    const mixed = new Map(bank);
    mixed.set(session.questionIds[0], { ...bank.get(session.questionIds[0])!, answerKey: { kind: 'accepted', options: [0, 3] } });
    mixed.set(session.questionIds[1], { ...bank.get(session.questionIds[1])!, answerKey: { kind: 'all-credit' } });
    session.optionOrders[session.questionIds[0]] = [2, 0, 3, 1];
    const paper = createPracticePaper(session, mixed, '2026-10-15');
    expect(paper.referenceAnswers.slice(0, 2)).toEqual(['B、C', '本題一律給分']);
    expect(paper.questions).toHaveLength(74);
    expect(() => createPracticePaper(session, new Map())).toThrow('尚未完整載入');
  });

  it('dates the paper in the exam board’s timezone', () => {
    expect(getTaipeiDateKey(new Date('2026-10-11T15:59:00Z'))).toBe('2026-10-11');
    expect(getTaipeiDateKey(new Date('2026-10-11T16:01:00Z'))).toBe('2026-10-12');
  });
});

describe('exam PDF layout', () => {
  afterEach(() => vi.restoreAllMocks());

  it.skipIf(!existsSync('C:/Windows/Fonts/mingliu.ttc'))('embeds the actual locally supplied PMingLiU and Times New Roman faces, never publishing font files', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    const { paper } = practicePaper(50, '2026-10-16');
    const onFontNotice = vi.fn();
    const bytes = await generateDailyPaperPdf(paper, { ...await fonts(), localFonts: {
      chinese: new Uint8Array(await readFile('C:/Windows/Fonts/mingliu.ttc')),
      latin: new Uint8Array(await readFile('C:/Windows/Fonts/times.ttf')),
    }, image: vi.fn(), onFontNotice });
    expect(onFontNotice).toHaveBeenCalledWith('本次使用 新細明體 / Times New Roman。');
    expect((await PDFDocument.load(bytes)).getKeywords()).toContain('新細明體 / Times New Roman');
    expect(drawText.mock.calls.map(([text]) => text).join('')).not.toContain('字型：');
  });
  it('respects installable/editable font permissions and rejects restricted embedding', () => {
    expect(allowsDailyFontEmbedding(0)).toBe(true);
    expect(allowsDailyFontEmbedding(8)).toBe(true);
    for (const flags of [2, 4, 256, 512]) expect(allowsDailyFontEmbedding(flags)).toBe(false);
    expect(allowsDailyFontEmbedding({})).toBe(true);
    expect(allowsDailyFontEmbedding({ noEmbedding: true })).toBe(false);
    expect(allowsDailyFontEmbedding({ noSubsetting: true })).toBe(false);
    expect(allowsDailyFontEmbedding({ viewOnly: true })).toBe(false);
  });
  it('wraps long text, respects explicit paragraphs and does not strand CJK punctuation', () => {
    const lines = wrapPaperText('甲乙丙，丁\n\nABCD', 3, text => Array.from(text).length);
    expect(lines).toEqual(['甲乙', '丙，丁', '', 'ABC', 'D']);
    expect(wrapPaperText('甲乙（丙丁）', 3, text => text.length)).toEqual(['甲乙', '（丙', '丁）']);
  });

  it('generates a real A4, embedded-font multi-page PDF with an independent final answer sheet', async () => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    const onFontNotice = vi.fn();
    const { paper } = practicePaper();
    const bytes = await generateDailyPaperPdf(paper, { ...await fonts(), image: vi.fn(), onFontNotice });
    expect(onFontNotice).toHaveBeenCalledWith(expect.stringContaining('未取得完整指定字型'));
    expect(drawText.mock.calls.map(([text]) => text).join('')).not.toContain('字型：');
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe(DAILY_PAPER_TITLE);
    expect(pdf.getPageCount()).toBeGreaterThan(3);
    expect(pdf.getPages().every(page => page.getWidth() === PageSizes.A4[0] && page.getHeight() === PageSizes.A4[1])).toBe(true);
    expect(bytes.length).toBeLessThan(4_000_000);
    expect(pdf.getPages().at(-1)!.node.normalizedEntries().Font.keys().length).toBeGreaterThan(0);
  });

  it('rejects incomplete keys and missing images instead of delivering an incomplete paper', async () => {
    const { paper } = practicePaper();
    const assets = await fonts();
    await expect(generateDailyPaperPdf({ ...paper, referenceAnswers: [] }, { ...assets, image: vi.fn() })).rejects.toThrow('參考答案不完整');
    paper.questions[0] = { ...paper.questions[0], content: [{ kind: 'image', src: '/question-bank/missing.png', width: 100, height: 100, alt: '必要題圖' }] };
    await expect(generateDailyPaperPdf(paper, { ...assets, image: vi.fn().mockRejectedValue(new Error('題圖載入失敗')) })).rejects.toThrow('題圖載入失敗');
  });
});
