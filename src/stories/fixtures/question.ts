import { createAttempt, getAcceptedAnswerIndexes, isQuestionCorrect } from '@/lib/study';
import type { DiscussionPost, Question, QuizAttempt } from '@/lib/types';
import { FIXTURE_NOW, fixtureImages } from './app-state';
import {
  fixtureQuestionsFor,
  getFixtureQuestion,
  screenshotQuestion,
  withExplanation,
} from './questions';

/**
 * 題目與筆記元件故事用的作答紀錄、投稿。題號都在範例題庫裡，答對／答錯／未作答
 * 的題數都由作答內容算出來，跟網站交卷時的算法一樣。
 */

function startedBefore(submittedAt: string, elapsedSeconds: number) {
  return new Date(Date.parse(submittedAt) - elapsedSeconds * 1000).toISOString();
}

/** 建立一筆作答紀錄：模擬考用網站的 createAttempt；每日抽題練習只算有作答的題目。 */
function storyAttempt({
  id,
  mode,
  questions,
  answers,
  submittedAt,
  elapsedSeconds,
}: {
  id: string;
  mode: QuizAttempt['mode'];
  questions: readonly Question[];
  answers: Record<string, number>;
  submittedAt: string;
  elapsedSeconds: number;
}): QuizAttempt {
  const startedAt = startedBefore(submittedAt, elapsedSeconds);
  if (mode === 'paper') {
    return {
      ...createAttempt({ mode, source: questions, answers, startedAt, elapsedSeconds }),
      id,
      submittedAt,
    };
  }
  const answered = questions.filter((question) => answers[question.id] !== undefined);
  const correctCount = answered.filter((question) =>
    isQuestionCorrect(question, answers[question.id]),
  ).length;
  const subjects = new Set(questions.map((question) => question.subject));
  return {
    id,
    mode,
    subject: subjects.size === 1 ? questions[0].subject : 'mixed',
    year: null,
    questionIds: questions.map((question) => question.id),
    answers: { ...answers },
    startedAt,
    submittedAt,
    elapsedSeconds,
    correctCount,
    wrongCount: answered.length - correctCount,
    unansweredCount: questions.length - answered.length,
  };
}

/** 整份試卷作答：列出的題目選錯、空白題不作答，其餘選正確答案。 */
function paperAnswers(
  questions: readonly Question[],
  wrong: Record<string, number>,
  blank: readonly string[],
) {
  const answers: Record<string, number> = {};
  questions.forEach((question) => {
    if (blank.includes(question.id)) return;
    const accepted = getAcceptedAnswerIndexes(question);
    const selected = wrong[question.id] ?? accepted[0] ?? 0;
    if (question.id in wrong && accepted.includes(selected)) {
      throw new Error(`${question.id} 的錯誤選項其實是正確答案`);
    }
    answers[question.id] = selected;
  });
  return answers;
}

/** 每日抽題練習的 8 題：答錯 3 題、答對 3 題、未作答 2 題（含一題一律給分）。 */
const practiceReviewQuestions = [
  'law-101-15',
  'law-101-08',
  'law-101-03',
  'law-101-27',
  'law-101-40',
  'law-101-17',
  'law-113-33',
  'law-101-39',
].map(getFixtureQuestion);

export const practiceReviewAttempt = storyAttempt({
  id: 'story-practice-attempt',
  mode: 'practice',
  questions: practiceReviewQuestions,
  answers: {
    'law-101-15': 3, // 答錯（正解 A）
    'law-101-08': 0, // 答對
    'law-101-03': 1, // 答對
    'law-101-27': 2, // 答錯（正解 A）
    'law-113-33': 3, // 答對（B、D 都給分）
    'law-101-39': 0, // 答錯（正解 B）
  },
  submittedAt: FIXTURE_NOW,
  elapsedSeconds: 412,
});

/** 更早的兩次練習：第 27 題連同這次共答錯 3 次、第 15 題共 2 次。 */
export const earlierPracticeAttempts: QuizAttempt[] = [
  storyAttempt({
    id: 'story-practice-attempt-earlier-1',
    mode: 'practice',
    questions: ['law-101-27', 'law-101-15', 'law-101-23'].map(getFixtureQuestion),
    answers: { 'law-101-27': 1, 'law-101-15': 2, 'law-101-23': 0 },
    submittedAt: '2026-10-12T13:05:00.000Z',
    elapsedSeconds: 180,
  }),
  storyAttempt({
    id: 'story-practice-attempt-earlier-2',
    mode: 'practice',
    questions: ['law-101-27', 'law-101-14'].map(getFixtureQuestion),
    answers: { 'law-101-27': 3, 'law-101-14': 2 },
    submittedAt: '2026-10-16T12:40:00.000Z',
    elapsedSeconds: 95,
  }),
];

export const law101Questions = fixtureQuestionsFor('law', 101);
export const law113Questions = fixtureQuestionsFor('law', 113);

/** 101 年法規模擬考：答錯 10 題（6 類）、空白 3 題（第 17 題一律給分）。 */
export const law101MockExamAttempt = storyAttempt({
  id: 'story-mock-exam-law-101',
  mode: 'paper',
  questions: law101Questions,
  answers: paperAnswers(
    law101Questions,
    {
      'law-101-08': 2,
      'law-101-15': 3,
      'law-101-23': 2,
      'law-101-27': 1,
      'law-101-39': 0,
      'law-101-44': 1,
      'law-101-56': 0,
      'law-101-63': 3,
      'law-101-68': 1,
      'law-101-71': 0,
    },
    ['law-101-17', 'law-101-52', 'law-101-79'],
  ),
  submittedAt: FIXTURE_NOW,
  elapsedSeconds: 5400,
});

/** 113 年法規模擬考：答錯 7 題、空白 1 題。 */
export const law113MockExamAttempt = storyAttempt({
  id: 'story-mock-exam-law-113',
  mode: 'paper',
  questions: law113Questions,
  answers: paperAnswers(
    law113Questions,
    {
      'law-113-02': 0,
      'law-113-12': 0,
      'law-113-27': 0,
      'law-113-29': 3,
      'law-113-44': 0,
      'law-113-63': 1,
      'law-113-66': 0,
    },
    ['law-113-75'],
  ),
  submittedAt: '2026-10-18T14:20:00.000Z',
  elapsedSeconds: 6120,
});

/** 截圖題（101 年法規第 15 題）的共享投稿：詳解附圖、補充、提問。 */
export const fixtureDiscussionPosts: DiscussionPost[] = [
  {
    id: 'story-post-explanation',
    questionId: screenshotQuestion.id,
    type: 'explanation',
    content:
      '建築法第 5 條所稱供公眾使用之建築物，**集合住宅要 6 層以上**才算；本題 5 層樓集合住宅不符合，所以選 A。',
    images: [fixtureImages[0]],
    createdAt: '2026-10-18T08:12:00.000Z',
    likes: 3,
    replies: [],
    reported: false,
  },
  {
    id: 'story-post-supplement',
    questionId: screenshotQuestion.id,
    type: 'supplement',
    content:
      '補充：工廠、市場、私人辦公大樓只要總樓地板面積達 1000 m^2^ 就算供公眾使用，跟層數無關。',
    images: [],
    createdAt: '2026-10-19T02:40:00.000Z',
    likes: 1,
    replies: [],
    reported: false,
  },
  {
    id: 'story-post-question',
    questionId: screenshotQuestion.id,
    type: 'question',
    content: '請問 6 層以上是看地上層數，還是含地下層？',
    images: [],
    createdAt: '2026-10-19T09:05:00.000Z',
    likes: 0,
    replies: [],
    reported: false,
  },
];

/** 標示為示範題的題目（實際題庫都是考選部官方試題）。 */
export const sampleSourceQuestion: Question = {
  ...screenshotQuestion,
  source: { kind: 'sample' },
};

/** 截圖題換成有內建詳解的版本，其他題目不變（實際題庫目前都沒有詳解）。 */
export function withScreenshotExplanation<T extends Question>(
  questions: readonly T[],
): T[] {
  return questions.map((question) =>
    question.id === screenshotQuestion.id ? (withExplanation(question) as T) : question,
  );
}

/**
 * Controls 的範例資料選單：args 裡存選項名稱，Storybook 用 mapping 換成實際資料。
 * `argType` 放進 argTypes，`initial` 放進 args（型別上當成實際資料）。
 */
export function fixtureOptions<K extends string, T>(
  choices: Record<K, T>,
  initial: NoInfer<K>,
) {
  return {
    argType: {
      control: 'select' as const,
      options: Object.keys(choices) as K[],
      mapping: choices,
    },
    initial: initial as unknown as T,
  };
}
