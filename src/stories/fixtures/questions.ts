import type { Question, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import construction113 from './question-data/construction-113.json';
import env113 from './question-data/env-113.json';
import law101 from './question-data/law-101.json';
import law113 from './question-data/law-113.json';
import law114 from './question-data/law-114.json';
import structure113 from './question-data/structure-113.json';

/**
 * 從實際題庫複製的六份試卷（法規 101、113、114 年，環控、構造、結構 113 年）。
 * Storybook 裡所有 `/question-data/{科目}/{年度}.json` 請求都由這份資料回應
 * （見 support/mock-fetch.ts），其他年度回傳空陣列。
 */
export const fixtureQuestionData: Record<string, readonly Question[]> = {
  'law:101': law101 as Question[],
  'law:113': law113 as Question[],
  'law:114': law114 as Question[],
  'env:113': env113 as Question[],
  'construction:113': construction113 as Question[],
  'structure:113': structure113 as Question[],
};

export const fixtureQuestions: readonly Question[] =
  Object.values(fixtureQuestionData).flat();

export function fixtureQuestionsFor(subject: SubjectId, year?: number) {
  return fixtureQuestions.filter(
    (question) =>
      question.subject === subject && (year === undefined || question.year === year),
  );
}

const subjectOrder = new Map<string, number>(
  subjects.map((subject, index) => [subject.id, index]),
);

/**
 * 跟伺服器端題庫（src/server/question-bank.server.ts）一樣的順序：科目、年度新到舊、
 * 申論題在前、題號小到大。照抄頁面 getStaticProps 時用這個，預設的第一題才會一樣。
 */
export function fixtureSubjectQuestions(subject?: SubjectId): Question[] {
  return fixtureQuestions
    .filter((question) => subject === undefined || question.subject === subject)
    .sort(
      (left, right) =>
        (subjectOrder.get(left.subject) ?? 99) -
          (subjectOrder.get(right.subject) ?? 99) ||
        right.year - left.year ||
        (left.format === 'written' ? 0 : 1) - (right.format === 'written' ? 0 : 1) ||
        left.questionNumber - right.questionNumber,
    );
}

export function getFixtureQuestion(id: string): Question {
  const question = fixtureQuestions.find((item) => item.id === id);
  if (!question) throw new Error(`Storybook 範例題庫沒有 ${id}`);
  return question;
}

/** 使用者截圖中的題目：101 年法規第 15 題（建築法第 5 條）。 */
export const screenshotQuestion = getFixtureQuestion('law-101-15');
/** 題幹含圖片的選擇題。 */
export const imageQuestion = getFixtureQuestion('law-101-08');
/** 題幹很長的選擇題（構造 113 年第 5 題，沒有圖片）。 */
export const longStemQuestion = getFixtureQuestion('construction-113-05');
/** 題幹加選項總長最長的選擇題（選項很長）。 */
export const longQuestion = [...fixtureQuestions]
  .filter((question) => question.format !== 'written')
  .sort(
    (left, right) =>
      right.text.length +
      right.options.join('').length -
      (left.text.length + left.options.join('').length),
  )[0];
/** 申論題（環控 113 年）。 */
export const writtenQuestion = fixtureQuestions.find(
  (question) => question.format === 'written',
)!;
/** 一律給分的題目。 */
export const allCreditQuestion = fixtureQuestions.find(
  (question) => question.format !== 'written' && question.answerKey.kind === 'all-credit',
)!;

/** 範例題目加上內建詳解，用來看詳解有內容時的樣子（實際題庫目前都沒有詳解）。 */
export function withExplanation(question: Question, explanation?: string): Question {
  return {
    ...question,
    explanation:
      explanation ??
      '依**建築法第 5 條**，供公眾使用之建築物為供公眾工作、營業、居住、遊覽、娛樂及其他供公眾使用之建築物。5 層樓集合住宅不在同法施行細則列舉範圍內，因此答案為 A。',
  };
}
