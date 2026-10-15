import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import { DAILY_PAPER_FONT, DAILY_PAPER_TITLE, dailyPaperFilename, type DailyPaper } from './daily-paper';

const [WIDTH, HEIGHT] = PageSizes.A4;
const MARGIN = 40;
const BOTTOM = 44;
const BODY_X = MARGIN + 45;
const BODY_WIDTH = WIDTH - MARGIN - BODY_X;
const SIZE = 11;
const LINE = 16.5;
const TOP = HEIGHT - 65;
const normalize = (text: string) => text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

/** Wrap real font metrics, preserving paragraphs and avoiding stranded CJK punctuation. */
export function wrapPaperText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of normalize(text).split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    const tokens = paragraph.match(/[A-Za-z0-9]+(?:[./_-][A-Za-z0-9]+)*|./gu) ?? [];
    for (const token of tokens) {
      const pieces = measure(token) > width ? Array.from(token) : [token];
      for (const piece of pieces) {
        if (line && measure(line + piece) > width) {
          let carry = '';
          if (/[（「『【(]$/u.test(line)) {
            carry = Array.from(line).pop()!;
            line = line.slice(0, -carry.length);
          } else if (/^[，。；：？！、）」』】,.;:!?)]/u.test(piece)) {
            carry = Array.from(line).pop()!;
            line = line.slice(0, -carry.length);
          }
          if (line) lines.push(line.trimEnd());
          line = carry + piece.trimStart();
        } else line += piece;
      }
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines;
}

export interface DailyPaperAssets {
  font: Uint8Array;
  image: (src: string) => Promise<Uint8Array>;
}

type Part = { text: string; x: number; size: number; height: number } |
  { image: PDFImage; width: number; height: number };

/** Pure document generation: no local storage writes, answer submission, or server requests. */
export async function generateDailyPaperPdf(paper: DailyPaper, assets: DailyPaperAssets): Promise<Uint8Array> {
  if (!paper.questions.length) throw new Error('沒有可列印的題目。');
  if (paper.referenceAnswers.length !== paper.questions.length) throw new Error('參考答案不完整，請重新載入試題。');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(assets.font, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const textWidth = (text: string, size: number) => font.widthOfTextAtSize(text, size);
  function checkText(text: string) {
    for (const char of normalize(text).replace(/\n/g, '')) {
      if (!supported.has(char.codePointAt(0)!)) throw new Error(`試卷字型缺少「${char}」，請回報題號以更新字型。`);
    }
    return normalize(text);
  }
  function draw(text: string, x: number, y: number, size = SIZE, activeFont: PDFFont = font) {
    page.drawText(checkText(text), { x, y, size, font: activeFont, color: rgb(0, 0, 0) });
  }
  pdf.setTitle(DAILY_PAPER_TITLE);
  pdf.setSubject(`${paper.date} ${paper.subjectName}`);
  pdf.setCreator('ShaneWeb 每日練習');
  let page = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - 46;
  // Fixed two-line title, like the official exam heading, not the application's dark theme.
  draw('專門職業及技術人員高等考試', MARGIN, y, 18);
  y -= 25;
  draw('建築師每日練習試題', MARGIN, y, 18);
  y -= 30;
  draw(`科　目：${paper.subjectName}`, MARGIN, y);
  draw(`日　期：${paper.date}`, WIDTH - MARGIN - 160, y);
  y -= 22;
  draw(`題　數：共 ${paper.questions.length} 題${paper.mode === 'adventure' ? '（含闖關備用題）' : ''}`, MARGIN, y);
  draw('座號／姓名：________________', WIDTH - MARGIN - 175, y);
  y -= 26;
  draw('注意：本卷為每日練習用，非正式考試試題；參考答案另附於末頁。', MARGIN, y, 10);
  y -= 16;
  draw('請將答案填寫於題號前括號內，可在空白處計算作答。', MARGIN, y, 10);
  y -= 13;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: WIDTH - MARGIN, y }, thickness: .5 });
  y -= 24;

  function nextPage() {
    page = pdf.addPage([WIDTH, HEIGHT]);
    draw(`${paper.date}　${paper.subjectName}　每日練習試題`, MARGIN, HEIGHT - 35, 10);
    y = TOP;
  }
  const imageCache = new Map<string, PDFImage>();
  async function imagePart(src: string): Promise<Part> {
    let embedded = imageCache.get(src);
    if (!embedded) {
      const bytes = await assets.image(src);
      embedded = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      imageCache.set(src, embedded);
    }
    // Never crop tall diagrams. Scale within a single page and retain aspect ratio.
    const scale = Math.min(1, BODY_WIDTH / embedded.width, 180 / embedded.height);
    return { image: embedded, width: embedded.width * scale, height: embedded.height * scale + 12 };
  }
  for (const [index, question] of paper.questions.entries()) {
    const parts: Part[] = [];
    for (const block of question.content) {
      if (block.kind === 'image') parts.push(await imagePart(block.src));
      else for (const text of wrapPaperText(checkText(block.text), BODY_WIDTH, text => textWidth(text, SIZE)))
        parts.push({ text, x: BODY_X, size: SIZE, height: LINE });
    }
    for (const [optionIndex, option] of question.options.entries()) {
      const label = `(${String.fromCharCode(65 + optionIndex)}) `;
      const labelWidth = textWidth(label, SIZE);
      for (const [lineIndex, text] of wrapPaperText(checkText(option), BODY_WIDTH - labelWidth, text => textWidth(text, SIZE)).entries()) {
        parts.push({ text: (lineIndex ? '' : label) + text,
          x: BODY_X + (lineIndex ? labelWidth : 0), size: SIZE, height: LINE });
      }
    }
    const height = LINE + parts.reduce((sum, part) => sum + part.height, 0) + 14;
    if (y - height < BOTTOM && (height <= TOP - BOTTOM || y - LINE - (parts[0]?.height ?? LINE) < BOTTOM)) nextPage();
    draw(`(　) ${index + 1}`, MARGIN - 5, y);
    draw(`原題：${question.year} 年第 ${question.questionNumber} 題`, BODY_X, y, 9);
    y -= LINE;
    for (const part of parts) {
      if (y - part.height < BOTTOM) {
        nextPage();
        draw(`第 ${index + 1} 題（續）`, MARGIN, y, 9);
        y -= LINE;
      }
      if ('image' in part) {
        page.drawImage(part.image, { x: BODY_X + (BODY_WIDTH - part.width) / 2,
          y: y - (part.height - 12), width: part.width, height: part.height - 12 });
      } else if (part.text) draw(part.text, part.x, y, part.size);
      y -= part.height;
    }
    y -= 14;
  }
  // Separate official-style answer sheet; never mix answers into question pages.
  page = pdf.addPage([WIDTH, HEIGHT]);
  y = HEIGHT - 48;
  draw('專門職業及技術人員高等考試', MARGIN, y, 18);
  y -= 25;
  draw('建築師每日練習試題　參考答案', MARGIN, y, 18);
  y -= 32;
  draw(`科　目：${paper.subjectName}`, MARGIN, y);
  draw(`日　期：${paper.date}`, WIDTH - MARGIN - 160, y);
  y -= 25;
  draw('依本次每日題號及選項順序對照，非原試卷題號或原選項順序。', MARGIN, y, 10);
  y -= 20;
  const columnWidth = (WIDTH - 2 * MARGIN) / 10;
  const rowHeight = 27;
  for (let start = 0; start < paper.questions.length; start += 10) {
    if (y - 2 * rowHeight < BOTTOM) { nextPage(); draw('參考答案（續）', MARGIN, y, 14); y -= 25; }
    for (let column = 0; column < Math.min(10, paper.questions.length - start); column++) {
      const x = MARGIN + columnWidth * column;
      const answer = paper.referenceAnswers[start + column];
      for (const [row, label] of [String(start + column + 1), answer].entries()) {
        page.drawRectangle({ x, y: y - (row + 1) * rowHeight,
          width: columnWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: .5 });
        const size = Math.min(12, 12 * (columnWidth - 8) / Math.max(1, textWidth(label, 12)));
        draw(label, x + (columnWidth - textWidth(label, size)) / 2, y - row * rowHeight - 18, size);
      }
    }
    y -= rowHeight * 2 + 15;
  }
  y -= 8;
  draw('註：多個字母表示任一所列選項均可；一律給分依原題庫標示。', MARGIN, y, 10);
  const pages = pdf.getPages();
  for (const [index, current] of pages.entries()) {
    page = current;
    const label = `第 ${index + 1} 頁，共 ${pages.length} 頁`;
    draw(label, WIDTH - MARGIN - textWidth(label, 10), 23, 10);
  }
  return pdf.save();
}

async function fetchBytes(src: string) {
  const response = await fetch(src, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('試卷字型或題圖載入失敗，請檢查網路後重試。');
  return new Uint8Array(await response.arrayBuffer());
}

async function browserImage(src: string) {
  // Only public question-bank assets; never fetch arbitrary remote/private URLs.
  if (!src.startsWith('/question-bank/') || src.includes('..')) throw new Error('題圖路徑不正確。');
  const bytes = await fetchBytes(src);
  if (bytes[0] === 0x89 || bytes[0] === 0xff) return bytes;
  // Some bank assets are WebP. Decode locally, retaining their actual pixel size.
  const bitmap = await createImageBitmap(new Blob([bytes.buffer]));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('此瀏覽器無法處理題圖，請換瀏覽器再試。');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('題圖轉換失敗。')), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { bitmap.close(); }
}

export async function downloadDailyPaperPdf(paper: DailyPaper) {
  const font = await fetchBytes(DAILY_PAPER_FONT);
  const bytes = await generateDailyPaperPdf(paper, { font, image: browserImage });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = dailyPaperFilename(paper);
  document.body.append(link);
  link.click();
  link.remove();
  // Give mobile browsers time to consume the download before revoking the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
