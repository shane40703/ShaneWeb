import { useState } from 'react';
import type { DailyPaper } from './daily-paper';

export interface LocalPaperFonts { chinese?: Uint8Array; latin?: Uint8Array }
interface LocalFont {
  postscriptName: string;
  blob: () => Promise<Blob>;
}

/** No upload, persistent font cache, or broad font inventory: only two requested faces. */
export async function requestLocalPaperFonts(): Promise<LocalPaperFonts> {
  const query = (window as Window & {
    queryLocalFonts?: (options: { postscriptNames: string[] }) => Promise<LocalFont[]>;
  }).queryLocalFonts;
  if (!query) return {};
  try {
    const fonts = await query.call(window, { postscriptNames: ['PMingLiU', 'TimesNewRomanPSMT'] });
    const read = async (name: string) => {
      const font = fonts.find(font => font.postscriptName === name);
      return font ? new Uint8Array(await (await font.blob()).arrayBuffer()) : undefined;
    };
    return { chinese: await read('PMingLiU'), latin: await read('TimesNewRomanPSMT') };
  } catch {
    // Permission denied, no matching fonts, or an unsupported browser: explicit fallback.
    return {};
  }
}

export function useDailyPaperDownload() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [fontNotice, setFontNotice] = useState('');
  async function download(getPaper: () => DailyPaper) {
    if (downloading) return;
    setDownloading(true); setError(''); setFontNotice('');
    try {
      const paper = getPaper();
      // Start the permission request within the click gesture, before loading the PDF engine.
      const fonts = requestLocalPaperFonts();
      const { downloadDailyPaperPdf } = await import('./daily-paper-pdf');
      await downloadDailyPaperPdf(paper, await fonts, notice => setFontNotice(`${paper.subjectName}：${notice}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PDF 下載失敗，請稍後再試。');
    } finally { setDownloading(false); }
  }
  return { downloading, error, fontNotice, download };
}
