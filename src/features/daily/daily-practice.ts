import { isSubjectId, pickRandomItems } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';

export const DAILY_PRACTICE_STORAGE_KEY = 'shaneweb:daily-practice';
export const DAILY_COMPLETION_STORAGE_KEY = 'shaneweb:daily-completions';
export const DAILY_QUESTIONS_PER_SUBJECT = 50;
export const DAILY_LEVEL_SIZE = 5;
export const DAILY_MAX_LIVES = 10;
export const DAILY_HEAL_STREAK = 3;

export interface DailyPracticeAnswer {
  selected: number;
  correct: boolean;
}

export interface DailyPracticeSession {
  date: string;
  subjects: SubjectId[];
  questionIds: string[];
  optionOrders: Record<string, number[]>;
  answers: Record<string, DailyPracticeAnswer>;
  eliminatedOptions: Record<string, number[]>;
  currentIndex: number;
  unreviewedWrongIds: string[];
  reviewedWrongIds: string[];
  status: 'practice' | 'review' | 'completed' | 'failed';
}

export interface DailyCompletionRecord {
  date: string;
  subjects: SubjectId[];
  results: Partial<Record<SubjectId, DailyCompletionResult>>;
}

export interface DailyCompletionResult {
  answered: number;
  correct: number;
  status: 'completed' | 'failed';
}

export function countDailyWrongAnswers(
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
) {
  return Object.values(answers).filter((answer) => !answer.correct).length;
}

export function getDailyLifeState(
  questionIds: readonly string[],
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
) {
  let streak = 0;
  let remaining = DAILY_MAX_LIVES;
  let restored = 0;
  for (const questionId of questionIds) {
    const answer = answers[questionId];
    if (!answer) break;
    if (!answer.correct) {
      streak = 0;
      remaining = Math.max(0, remaining - 1);
      if (remaining === 0) break;
      continue;
    }
    streak += 1;
    if (streak === DAILY_HEAL_STREAK) {
      if (remaining < DAILY_MAX_LIVES) {
        remaining += 1;
        restored += 1;
      }
      streak = 0;
    }
  }
  return { remaining, restored, streak };
}

export function createDailyCompletionResult(
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
  status: DailyCompletionResult['status'],
): DailyCompletionResult {
  const answered = Object.keys(answers).length;
  return {
    answered,
    correct: answered - countDailyWrongAnswers(answers),
    status,
  };
}

export function getTaipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getMillisecondsUntilTaipeiMidnight(date = new Date()) {
  const [year, month, day] = getTaipeiDateKey(date).split('-').map(Number);
  const nextMidnight = Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000;
  return Math.max(1, nextMidnight - date.getTime());
}

function shuffledOptionIndexes(length: number, random: () => number) {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swapWith]] = [indexes[swapWith], indexes[index]];
  }
  return indexes;
}

export function applyDailyOptionOrder(
  question: Question,
  order: readonly number[] | undefined,
): Question {
  if (
    !order ||
    order.length !== question.options.length ||
    new Set(order).size !== question.options.length ||
    order.some((index) => index < 0 || index >= question.options.length)
  ) {
    return question;
  }
  return {
    ...question,
    options: order.map((index) => question.options[index]),
    answerKey: question.answerKey.kind === 'accepted'
      ? {
          kind: 'accepted',
          options: question.answerKey.options.map((index) => order.indexOf(index)),
        }
      : question.answerKey,
  };
}

export function createDailyPracticeSession(
  questions: readonly Question[],
  subjects: readonly SubjectId[],
  date = getTaipeiDateKey(),
  random: () => number = Math.random,
): DailyPracticeSession {
  const selectedSubjects = [...new Set(subjects)].slice(0, 1);
  const questionIds = selectedSubjects.flatMap((subject) =>
    pickRandomItems(
      questions.filter(
        (question) =>
          question.subject === subject && question.answerKey.kind !== 'written',
      ),
      DAILY_QUESTIONS_PER_SUBJECT,
      random,
    ).map((question) => question.id),
  );
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const optionOrders = Object.fromEntries(
    questionIds.map((id) => {
      const optionCount = questionById.get(id)?.options.length ?? 0;
      return [id, shuffledOptionIndexes(optionCount, random)];
    }),
  );
  return {
    date,
    subjects: selectedSubjects,
    questionIds,
    optionOrders,
    answers: {},
    eliminatedOptions: {},
    currentIndex: 0,
    unreviewedWrongIds: [],
    reviewedWrongIds: [],
    status: 'practice',
  };
}

function isDailyAnswer(value: unknown): value is DailyPracticeAnswer {
  if (!value || typeof value !== 'object') return false;
  const answer = value as Partial<DailyPracticeAnswer>;
  return Number.isInteger(answer.selected) && typeof answer.correct === 'boolean';
}

export function parseDailyPracticeSession(
  raw: string | null,
  today = getTaipeiDateKey(),
): DailyPracticeSession | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const session = value as Partial<DailyPracticeSession>;
  const subjects = Array.isArray(session.subjects)
    ? [...new Set(session.subjects.filter(isSubjectId))]
    : [];
  const maximumQuestions = subjects.length * DAILY_QUESTIONS_PER_SUBJECT;
  const questionIds = Array.isArray(session.questionIds)
    ? [...new Set(session.questionIds.filter((id): id is string => typeof id === 'string'))]
        .slice(0, maximumQuestions)
    : [];
  if (
    session.date !== today ||
    !subjects.length ||
    !questionIds.length ||
    !Number.isInteger(session.currentIndex) ||
    subjects.length !== 1 ||
    !['practice', 'review', 'completed', 'failed'].includes(
      session.status ?? '',
    )
  ) {
    return null;
  }
  const answers = Object.fromEntries(
    Object.entries(session.answers ?? {}).filter(
      ([id, answer]) => questionIds.includes(id) && isDailyAnswer(answer),
    ),
  );
  const optionOrders: Record<string, number[]> = Object.fromEntries(
    Object.entries(session.optionOrders ?? {}).flatMap(([id, indexes]) => {
      if (!questionIds.includes(id) || !Array.isArray(indexes)) return [];
      const order = indexes.filter((index): index is number =>
        Number.isInteger(index) && index >= 0,
      );
      return order.length === indexes.length && new Set(order).size === order.length
        ? [[id, order]]
        : [];
    }),
  );
  const eliminatedOptions: Record<string, number[]> = Object.fromEntries(
    Object.entries(session.eliminatedOptions ?? {}).flatMap(([id, indexes]) => {
      if (!questionIds.includes(id) || !Array.isArray(indexes)) return [];
      return [[
        id,
        [...new Set(indexes.filter((index): index is number =>
          Number.isInteger(index) && index >= 0,
        ))],
      ]];
    }),
  );
  const validWrongIds = (ids: unknown) =>
    Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string =>
          typeof id === 'string' && questionIds.includes(id),
        ))]
      : [];
  const unreviewedWrongIds = validWrongIds(session.unreviewedWrongIds);
  const reviewedWrongIds = validWrongIds(session.reviewedWrongIds);
  const lifeState = getDailyLifeState(questionIds, answers);
  const status = session.status === 'completed'
    ? 'completed'
    : lifeState.remaining <= 0
      ? 'failed'
      : session.status === 'failed'
        ? 'practice'
        : session.status as DailyPracticeSession['status'];
  return {
    date: session.date,
    subjects,
    questionIds,
    optionOrders,
    answers,
    eliminatedOptions,
    currentIndex: Math.min(
      Math.max(0, session.currentIndex as number),
      questionIds.length,
    ),
    unreviewedWrongIds,
    reviewedWrongIds,
    status,
  };
}

export function parseDailyCompletionRecord(
  raw: string | null,
  today = getTaipeiDateKey(),
): DailyCompletionRecord {
  if (!raw) return { date: today, subjects: [], results: {} };
  try {
    const value = JSON.parse(raw) as Partial<DailyCompletionRecord>;
    if (value.date !== today || !Array.isArray(value.subjects)) {
      return { date: today, subjects: [], results: {} };
    }
    const subjects = [...new Set(value.subjects.filter(isSubjectId))];
    const results: DailyCompletionRecord['results'] = {};
    const storedResults = value.results && typeof value.results === 'object'
      ? value.results
      : {};
    subjects.forEach((subject) => {
      const result = storedResults[subject];
      if (
        result &&
        Number.isInteger(result.answered) &&
        result.answered >= 0 &&
        result.answered <= DAILY_QUESTIONS_PER_SUBJECT &&
        Number.isInteger(result.correct) &&
        result.correct >= 0 &&
        result.correct <= result.answered &&
        ['completed', 'failed'].includes(result.status)
      ) {
        results[subject] = result;
      }
    });
    return {
      date: today,
      subjects,
      results,
    };
  } catch {
    return { date: today, subjects: [], results: {} };
  }
}

export function shouldEnterDailyReview(
  nextIndex: number,
  total: number,
  wrongCount: number,
) {
  return (
    wrongCount > 0 &&
    (nextIndex % DAILY_LEVEL_SIZE === 0 || nextIndex >= total)
  );
}
