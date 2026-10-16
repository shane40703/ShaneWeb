import { isSubjectId } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';
import { createDailyPracticeSession, parseDailyPracticeSession, type DailyPracticeSession } from './daily-practice';

/** One normal-mode assignment per subject and Taipei date; never stores answers. */
export interface DailyQuestionSets {
  date: string;
  sets: Partial<Record<SubjectId, DailyPracticeSession>>;
}

function freshNormalSession(session: DailyPracticeSession): DailyPracticeSession {
  return {
    ...createDailyPracticeSession([], session.subjects, session.date, undefined, 'normal'),
    questionIds: [...session.questionIds],
    optionOrders: Object.fromEntries(Object.entries(session.optionOrders).map(([id, order]) => [id, [...order]])),
  };
}

export function rememberDailyNormalSet(record: DailyQuestionSets, session: DailyPracticeSession): DailyQuestionSets {
  if (session.mode !== 'normal' || !session.questionIds.length) return record;
  return {
    date: session.date,
    sets: {
      ...(record.date === session.date ? record.sets : {}),
      [session.subjects[0]]: freshNormalSession(session),
    },
  };
}

/** Accept the former single-paper snapshot without losing its assigned order. */
export function parseDailyQuestionSets(raw: string | null, today: string): DailyQuestionSets {
  const empty: DailyQuestionSets = { date: today, sets: {} };
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.date !== today) return empty;
    if (!value.sets) {
      const legacy = parseDailyPracticeSession(raw, today);
      return legacy ? rememberDailyNormalSet(empty, legacy) : empty;
    }
    if (typeof value.sets !== 'object' || Array.isArray(value.sets)) return empty;
    let record = empty;
    for (const [subject, stored] of Object.entries(value.sets)) {
      if (!isSubjectId(subject)) continue;
      const session = parseDailyPracticeSession(JSON.stringify(stored), today);
      if (session?.mode === 'normal' && session.subjects[0] === subject) record = rememberDailyNormalSet(record, session);
    }
    return record;
  } catch { return empty; }
}

/** Replay only resets answers/progress; it never redraws an existing assignment. */
export function getDailyNormalSession(
  record: DailyQuestionSets,
  questions: readonly Question[],
  subject: SubjectId,
  today: string,
  random: () => number = Math.random,
) {
  const cached = record.date === today ? record.sets[subject] : undefined;
  const session = cached ? freshNormalSession(cached)
    : createDailyPracticeSession(questions, [subject], today, random, 'normal');
  const nextRecord = rememberDailyNormalSet(record.date === today ? record : { date: today, sets: {} }, session);
  return { session, record: nextRecord };
}
