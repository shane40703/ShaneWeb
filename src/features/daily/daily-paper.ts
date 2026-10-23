import type { Question } from '@/lib/types';

export const DAILY_PAPER_TITLE = '專門職業及技術人員高等考試建築師每日練習試題';
export const DAILY_PAPER_FONT = '/fonts/daily-paper/paper-ming.ttf';
export const DAILY_PAPER_LATIN_FONT = '/fonts/daily-paper/paper-times.ttf';

// Questions omit answers; the separate key is used only on the PDF's final page.
export type DailyPaperQuestion = Pick<Question, 'id' | 'year' | 'questionNumber' | 'content' | 'options'>;
export interface DailyPaper {
  date: string;
  subjectName: string;
  questions: DailyPaperQuestion[];
  referenceAnswers: string[];
  /** Replaces the answer page's order note; unset keeps the daily wording. */
  answerKeyNote?: string;
}

/** The paper's date in the exam board's timezone, e.g. 2026-10-15. */
export function getTaipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dailyPaperFilename(paper: DailyPaper) {
  return `建築師每日練習-${paper.date}-${paper.subjectName}.pdf`;
}
