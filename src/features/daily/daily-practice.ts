import { isSubjectId, pickRandomItems } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';

export const DAILY_PRACTICE_STORAGE_KEY = 'shaneweb:daily-practice';
export const DAILY_QUESTIONS_PER_SUBJECT = 50;
export const DAILY_LEVEL_SIZE = 5;
export const DAILY_WRONG_LIMIT = 3;

export interface DailyPracticeAnswer {
  selected: number;
  correct: boolean;
}

export interface DailyPracticeSession {
  date: string;
  subjects: SubjectId[];
  questionIds: string[];
  answers: Record<string, DailyPracticeAnswer>;
  currentIndex: number;
  unreviewedWrongIds: string[];
  reviewedWrongIds: string[];
  status: 'practice' | 'review' | 'completed';
}

export function getTaipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function createDailyPracticeSession(
  questions: readonly Question[],
  subjects: readonly SubjectId[],
  date = getTaipeiDateKey(),
  random: () => number = Math.random,
): DailyPracticeSession {
  const selectedSubjects = [...new Set(subjects)];
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
  return {
    date,
    subjects: selectedSubjects,
    questionIds,
    answers: {},
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
    !['practice', 'review', 'completed'].includes(session.status ?? '')
  ) {
    return null;
  }
  const answers = Object.fromEntries(
    Object.entries(session.answers ?? {}).filter(
      ([id, answer]) => questionIds.includes(id) && isDailyAnswer(answer),
    ),
  );
  const validWrongIds = (ids: unknown) =>
    Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string =>
          typeof id === 'string' && questionIds.includes(id),
        ))]
      : [];
  return {
    date: session.date,
    subjects,
    questionIds,
    answers,
    currentIndex: Math.min(
      Math.max(0, session.currentIndex as number),
      questionIds.length,
    ),
    unreviewedWrongIds: validWrongIds(session.unreviewedWrongIds),
    reviewedWrongIds: validWrongIds(session.reviewedWrongIds),
    status: session.status as DailyPracticeSession['status'],
  };
}

export function shouldEnterDailyReview(
  nextIndex: number,
  total: number,
  wrongCount: number,
) {
  return (
    wrongCount > 0 &&
    (wrongCount >= DAILY_WRONG_LIMIT ||
      nextIndex % DAILY_LEVEL_SIZE === 0 ||
      nextIndex >= total)
  );
}
