import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import { DAILY_PAPER_FONT, DAILY_PAPER_LATIN_FONT, DAILY_PAPER_TITLE, dailyPaperFilename, type DailyPaper } from './daily-paper';
import type { LocalPaperFonts } from './daily-paper-download';

const [WIDTH, HEIGHT] = PageSizes.A4;
const MARGIN = 36;
const BOTTOM = 35;
const BODY_X = MARGIN + 18;
const BODY_WIDTH = WIDTH - MARGIN - BODY_X;
const SIZE = 11.5;
const LINE = 18;
const TOP = HEIGHT - 62;
const normalize = (text: string) => text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

/** Real mixed-font metrics, paragraphs and CJK punctuation protection. */
export function wrapPaperText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of normalize(text).split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const token of paragraph.match(/[A-Za-z0-9]+(?:[./_-][A-Za-z0-9]+)*|./gu) ?? []) {
      const pieces = measure(token) > width ? Array.from(token) : [token];
      for (const piece of pieces) {
        if (line && measure(line + piece) > width) {
          let carry = '';
          if (/[（「『【(]$/u.test(line) || /^[，。；：？！、）」』】,.;:!?)]/u.test(piece)) {
            carry = Array.from(line).pop()!;
            line = line.slice(0, -carry.length);
          }
          if (line) lines.push(line.trimEnd());
          line = carry;
          // A carried opening bracket plus a near-full-width Latin token must still fit.
          for (const char of Array.from(piece.trimStart())) {
            if (line && measure(line + char) > width) { lines.push(line.trimEnd()); line = ''; }
            line += char;
          }
        } else line += piece;
      }
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines;
}

export interface DailyPaperAssets {
  font: Uint8Array;
  latinFont: Uint8Array;
  localFonts?: LocalPaperFonts;
  onFontNotice?: (notice: string) => void;
  image: (src: string) => Promise<Uint8Array>;
}

type Part = { cells: Array<{ text: string; x: number }>; height: number } |
  { image: PDFImage; width: number; height: number };

/** Restrictive/preview-only/no-subsetting fonts are not used by this editable-font pipeline. */
type EmbeddingFlags = { noEmbedding?: boolean; viewOnly?: boolean; noSubsetting?: boolean; bitmapOnly?: boolean };
export function allowsDailyFontEmbedding(fsType: number | EmbeddingFlags) {
  return typeof fsType === 'number' ? (fsType & (0x0002 | 0x0004 | 0x0100 | 0x0200)) === 0
    : !fsType.noEmbedding && !fsType.viewOnly && !fsType.noSubsetting && !fsType.bitmapOnly;
}

function localFace(bytes: Uint8Array | undefined, name: string) {
  if (!bytes) return undefined;
  try {
    const collection = bytes[0] === 0x74 && bytes[1] === 0x74 && bytes[2] === 0x63 && bytes[3] === 0x66;
    const face = collection ? fontkit.create(bytes, name) : fontkit.create(bytes);
    const flags = (face['OS/2'] as { fsType?: number | EmbeddingFlags }).fsType;
    return face.postscriptName === name && flags !== undefined && allowsDailyFontEmbedding(flags) ? face : undefined;
  } catch { return undefined; }
}

/** No state mutation, answer submission, or server-side PDF service. */
export async function generateDailyPaperPdf(paper: DailyPaper, assets: DailyPaperAssets): Promise<Uint8Array> {
  if (!paper.questions.length) throw new Error('沒有可列印的題目。');
  if (paper.referenceAnswers.length !== paper.questions.length) throw new Error('參考答案不完整，請重新載入試題。');
  const pdf = await PDFDocument.create();
  const localChinese = localFace(assets.localFonts?.chinese, 'PMingLiU');
  const localLatin = localFace(assets.localFonts?.latin, 'TimesNewRomanPSMT');
  const chineseBytes = localChinese ? assets.localFonts!.chinese! : assets.font;
  const latinBytes = localLatin ? assets.localFonts!.latin! : assets.latinFont;
  // Local fonts can be TTC collections. Select the requested face, not the first face.
  pdf.registerFontkit({ create: bytes => bytes === chineseBytes && localChinese ? localChinese
    : bytes === latinBytes && localLatin ? localLatin : fontkit.create(bytes) });
  const chinese = await pdf.embedFont(chineseBytes, { subset: Boolean(localChinese) });
  const latin = await pdf.embedFont(latinBytes, { subset: Boolean(localLatin) });
  const fallbackChinese = localChinese ? await pdf.embedFont(assets.font) : chinese;
  const fallbackLatin = localLatin ? await pdf.embedFont(assets.latinFont) : latin;
  const symbol = await pdf.embedFont(StandardFonts.Symbol);
  const fonts = [chinese, latin, fallbackChinese, fallbackLatin, symbol];
  const supported = new Map(fonts.map(font => [font, new Set(font.getCharacterSet())]));
  const fontLabel = `${localChinese ? '新細明體' : '開源明體 Noto Serif TC'} / ${localLatin ? 'Times New Roman' : 'Tinos（Times 風格）'}`;
  const notice = localChinese && localLatin ? `本次使用 ${fontLabel}。`
    : `未取得完整指定字型或字型不允許嵌入，本次改用：${fontLabel}。`;
  assets.onFontNotice?.(notice);
  function runs(text: string) {
    const result: Array<{ font: PDFFont; text: string }> = [];
    for (const char of normalize(text)) {
      const code = char.codePointAt(0)!;
      const latinChar = /[\x20-\x7e\u00c0-\u024f\u0370-\u03ff]|\p{Number}/u.test(char);
      const order = latinChar ? [latin, chinese, fallbackLatin, fallbackChinese, symbol] : fonts;
      const font = order.find(font => supported.get(font)!.has(code));
      if (!font) throw new Error(`試卷字型缺少「${char}」，請回報題號以更新字型。`);
      const previous = result.at(-1);
      if (previous?.font === font) previous.text += char;
      else result.push({ font, text: char });
    }
    return result;
  }
  const textWidth = (text: string, size: number) => runs(text).reduce((width, run) => width + run.font.widthOfTextAtSize(run.text, size), 0);
  function draw(text: string, x: number, y: number, size = SIZE) {
    for (const run of runs(text)) {
      page.drawText(run.text, { x, y, size, font: run.font, color: rgb(0, 0, 0) });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
  }
  pdf.setTitle(DAILY_PAPER_TITLE);
  pdf.setSubject(`${paper.date} ${paper.subjectName}`);
  pdf.setCreator('ShaneWeb 每日練習');
  pdf.setKeywords([fontLabel]);
  let page = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - 38;
  draw('專門職業及技術人員高等考試建築師', MARGIN, y, 16);
  y -= 23;
  draw('每日練習試題', MARGIN, y, 16);
  y -= 26;
  draw('等　　別：高等考試', MARGIN, y);
  y -= 19;
  draw('類　　科：建築師', MARGIN, y);
  y -= 19;
  draw(`科　　目：${paper.subjectName}`, MARGIN, y);
  y -= 19;
  draw(`練習日期：${paper.date}`, MARGIN, y);
  draw('座號：________________', WIDTH - MARGIN - 160, y);
  y -= 25;
  draw('注意：㈠本試題均為選擇題，請選出一個正確或最適當的答案。', MARGIN, y, 10);
  y -= 15;
  draw(`　　　㈡本試題共 ${paper.questions.length} 題${paper.mode === 'adventure' ? '（含闖關備用題）' : ''}，參考答案另附於試題後。`, MARGIN, y, 10);
  y -= 15;
  draw('　　　㈢答案請自行書寫，可利用空白處計算。', MARGIN, y, 10);
  y -= 25;
  function nextPage() { page = pdf.addPage([WIDTH, HEIGHT]); y = TOP; }
  const imageCache = new Map<string, PDFImage>();
  async function imagePart(src: string): Promise<Part> {
    let image = imageCache.get(src);
    if (!image) {
      const bytes = await assets.image(src);
      image = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      imageCache.set(src, image);
    }
    const scale = Math.min(.5, BODY_WIDTH / image.width, 160 / image.height);
    return { image, width: image.width * scale, height: image.height * scale + 10 };
  }
  for (const [index, question] of paper.questions.entries()) {
    const parts: Part[] = [];
    for (const block of question.content) {
      if (block.kind === 'image') parts.push(await imagePart(block.src));
      else for (const text of wrapPaperText(block.text, BODY_WIDTH, text => textWidth(text, SIZE)))
        parts.push({ cells: [{ text, x: BODY_X }], height: LINE });
    }
    const options = question.options.map((option, i) => `(${String.fromCharCode(65 + i)}) ${option}`);
    const columns = options.length === 4 && options.every(option => !/[\r\n]/u.test(option) && textWidth(option, SIZE) <= BODY_WIDTH / 4 - 8) ? 4
      : options.length === 4 && options.every(option => !/[\r\n]/u.test(option) && textWidth(option, SIZE) <= BODY_WIDTH / 2 - 8) ? 2 : 1;
    if (columns > 1) {
      for (let i = 0; i < options.length; i += columns) parts.push({
        cells: options.slice(i, i + columns).map((text, column) => ({ text, x: BODY_X + column * BODY_WIDTH / columns })), height: LINE,
      });
    } else {
      for (const [optionIndex, option] of question.options.entries()) {
        const label = `(${String.fromCharCode(65 + optionIndex)}) `;
        const labelWidth = textWidth(label, SIZE);
        for (const [lineIndex, text] of wrapPaperText(option, BODY_WIDTH - labelWidth, text => textWidth(text, SIZE)).entries())
          parts.push({ cells: [{ text: (lineIndex ? '' : label) + text, x: BODY_X + (lineIndex ? labelWidth : 0) }], height: LINE });
      }
    }
    const height = parts.reduce((sum, part) => sum + part.height, 0) + 23;
    if (y - height < BOTTOM && (height <= TOP - BOTTOM || y - (parts[0]?.height ?? LINE) < BOTTOM)) nextPage();
    draw(String(index + 1), MARGIN + 2, y);
    for (const part of parts) {
      if (y - part.height < BOTTOM + 16) {
        nextPage(); draw(`第 ${index + 1} 題（續）`, MARGIN, y, 9); y -= LINE;
      }
      if ('image' in part) page.drawImage(part.image, { x: BODY_X + (BODY_WIDTH - part.width) / 2,
        y: y - part.height + 10, width: part.width, height: part.height - 10 });
      else for (const cell of part.cells) if (cell.text) draw(cell.text, cell.x, y);
      y -= part.height;
    }
    const source = `(${question.year}-${question.questionNumber})`;
    draw(source, WIDTH - MARGIN - textWidth(source, 9), y + 2, 9);
    y -= 23;
  }

  page = pdf.addPage([WIDTH, HEIGHT]); y = HEIGHT - 38;
  draw('專門職業及技術人員高等考試建築師', MARGIN, y, 16); y -= 23;
  draw('每日練習試題　參考答案', MARGIN, y, 16); y -= 32;
  draw(`科　目：${paper.subjectName}`, MARGIN, y);
  draw(`日期：${paper.date}`, WIDTH - MARGIN - 140, y); y -= 25;
  draw(paper.answerKeyNote ?? '依本次每日題號及選項順序對照，非原試卷題號或原選項順序。', MARGIN, y, 10); y -= 20;
  const columnWidth = (WIDTH - 2 * MARGIN) / 10;
  const rowHeight = 27;
  for (let start = 0; start < paper.questions.length; start += 10) {
    if (y - 2 * rowHeight < BOTTOM + 50) { nextPage(); draw('參考答案（續）', MARGIN, y, 14); y -= 25; }
    for (let column = 0; column < Math.min(10, paper.questions.length - start); column++) {
      const x = MARGIN + columnWidth * column;
      for (const [row, label] of [String(start + column + 1), paper.referenceAnswers[start + column]].entries()) {
        page.drawRectangle({ x, y: y - (row + 1) * rowHeight, width: columnWidth, height: rowHeight, borderColor: rgb(0, 0, 0), borderWidth: .5 });
        const size = Math.min(12, 12 * (columnWidth - 8) / Math.max(1, textWidth(label, 12)));
        draw(label, x + (columnWidth - textWidth(label, size)) / 2, y - row * rowHeight - 18, size);
      }
    }
    y -= rowHeight * 2 + 15;
  }
  draw('註：多個字母表示任一所列選項均可。', MARGIN, y - 8, 10);
  const pages = pdf.getPages();
  for (const [index, current] of pages.entries()) {
    page = current;
    const label = `頁次：${pages.length}-${index + 1}`;
    draw(label, WIDTH - MARGIN - textWidth(label, 10), HEIGHT - 38, 10);
  }
  return pdf.save();
}

async function fetchBytes(src: string) {
  const response = await fetch(src, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('試卷字型或題圖載入失敗，請檢查網路後重試。');
  return new Uint8Array(await response.arrayBuffer());
}

async function browserImage(src: string) {
  if (!src.startsWith('/question-bank/') || src.includes('..')) throw new Error('題圖路徑不正確。');
  const bytes = await fetchBytes(src);
  if (bytes[0] === 0x89 || bytes[0] === 0xff) return bytes;
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

export async function downloadDailyPaperPdf(paper: DailyPaper, localFonts: LocalPaperFonts = {}, onFontNotice?: (notice: string) => void) {
  const [font, latinFont] = await Promise.all([fetchBytes(DAILY_PAPER_FONT), fetchBytes(DAILY_PAPER_LATIN_FONT)]);
  const bytes = await generateDailyPaperPdf(paper, { font, latinFont, localFonts, onFontNotice, image: browserImage });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url; link.download = dailyPaperFilename(paper);
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
