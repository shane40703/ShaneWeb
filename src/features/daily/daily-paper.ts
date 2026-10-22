import type { Question } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { formatCorrectAnswer } from '@/lib/study';
import { applyDailyOptionOrder, type DailyPracticeSession } from './daily-practice';

export const DAILY_PAPER_TITLE = '專門職業及技術人員高等考試建築師每日練習試題';
export const DAILY_PAPER_FONT = '/fonts/daily-paper/paper-ming.ttf';
export const DAILY_PAPER_LATIN_FONT = '/fonts/daily-paper/paper-times.ttf';

// Questions omit answers; the separate key is used only on the PDF's final page.
export type DailyPaperQuestion = Pick<Question, 'id' | 'year' | 'questionNumber' | 'content' | 'options'>;
export interface DailyPaper {
  date: string;
  subjectName: string;
  mode: 'normal' | 'adventure';
  questions: DailyPaperQuestion[];
  referenceAnswers: string[];
  /** Replaces the answer page's order note; unset keeps the daily wording. */
  answerKeyNote?: string;
}

export function createDailyPaper(session: DailyPracticeSession, questionById: ReadonlyMap<string, Question>): DailyPaper {
  const questions = session.questionIds.map(id => {
    const question = questionById.get(id);
    if (!question) throw new Error('當日題目尚未完整載入，請重新載入後再試。');
    const displayed = applyDailyOptionOrder(question, session.optionOrders[id]);
    return { id, year: question.year, questionNumber: question.questionNumber,
      content: question.content, options: displayed.options };
  });
  if (!questions.length) throw new Error('請先建立今日試題。');
  return {
    date: session.date,
    subjectName: subjects.find(subject => subject.id === session.subjects[0])?.name ?? '',
    mode: session.mode === 'adventure' ? 'adventure' : 'normal', questions,
    referenceAnswers: session.questionIds.map(id => formatCorrectAnswer(
      applyDailyOptionOrder(questionById.get(id)!, session.optionOrders[id]),
    )),
  };
}

export function dailyPaperFilename(paper: DailyPaper) {
  return `建築師每日練習-${paper.date}-${paper.subjectName}.pdf`;
}
