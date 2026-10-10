import { isSubjectId, pickRandomItems } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';

export const DAILY_PRACTICE_STORAGE_KEY = 'shaneweb:daily-practice';
export const DAILY_COMPLETION_STORAGE_KEY = 'shaneweb:daily-completions';
export const DAILY_QUESTIONS_PER_SUBJECT = 50;
export const DAILY_HEAL_STREAK = 3;
export const DAILY_QUESTION_SECONDS = 60;
export const DAILY_BARRIER_SECONDS = 10;
export const DAILY_GUARD_WINDOW_MS = 3000;

export const DAILY_BOSS_SKILLS = [
  '紅磚投擲', '鋼梁橫掃', '鷹架震擊', '玻璃風刃', '地基震波', '屋頂龍息',
] as const;

export const DAILY_STAGES = [
  { name: '磚造巷口', boss: '砌縫咕嚕', questions: 5, wrongLimit: 3 },
  { name: '鋼構工地', boss: '鋼梁鉗獸', questions: 6, wrongLimit: 3 },
  { name: '鷹架高塔', boss: '鷹架巨像', questions: 7, wrongLimit: 4 },
  { name: '玻璃天際', boss: '帷幕幽靈', questions: 8, wrongLimit: 4 },
  { name: '混凝土要塞', boss: '鋼筋堡壘獸', questions: 9, wrongLimit: 3 },
  { name: '終極屋頂', boss: '天際龍王', questions: 15, wrongLimit: 3 },
] as const;
export const DAILY_STAGE_COUNT = DAILY_STAGES.length;

export const DAILY_RELIC_TYPES = [
  'eliminate',
  'barrier',
] as const;
export type DailyRelicType = (typeof DAILY_RELIC_TYPES)[number];

export interface DailyPracticeAnswer {
  selected: number;
  correct: boolean;
  timedOut?: boolean;
}

export interface DailyPracticeSession {
  date: string;
  subjects: SubjectId[];
  questionIds: string[];
  optionOrders: Record<string, number[]>;
  answers: Record<string, DailyPracticeAnswer>;
  eliminatedOptions: Record<string, number[]>;
  relicUses: Partial<Record<string, DailyRelicType>>;
  protectedWrongIds: string[];
  questionDeadlineMs?: number;
  barrierUntilMs?: number;
  guardUses?: Record<string, 'early' | 'perfect'>;
  guardUntilMs?: number;
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

export function getDailyStageIndex(questionIndex: number) {
  const safeIndex = Math.max(0, Math.min(questionIndex, DAILY_QUESTIONS_PER_SUBJECT - 1));
  let boundary = 0;
  for (const [index, stage] of DAILY_STAGES.entries()) {
    boundary += stage.questions;
    if (safeIndex < boundary) return index;
  }
  return DAILY_STAGE_COUNT - 1;
}

export function getDailyStageBounds(stageIndex: number) {
  const safeStageIndex = Math.max(0, Math.min(stageIndex, DAILY_STAGE_COUNT - 1));
  const start = DAILY_STAGES
    .slice(0, safeStageIndex)
    .reduce((total, stage) => total + stage.questions, 0);
  return { start, end: start + DAILY_STAGES[safeStageIndex].questions };
}

export function getDailyLifeState(
  questionIds: readonly string[],
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
  protectedWrongIds: readonly string[] = [],
  questionIndex = Math.max(0, Math.min(Object.keys(answers).length, questionIds.length - 1)),
) {
  const protectedIds = new Set(protectedWrongIds);
  let streak = 0;
  let restored = 0;
  let relicsEarned = 0;
  let currentStageIndex = 0;
  let remaining: number = DAILY_STAGES[0].wrongLimit;
  let maximum: number = remaining;
  let failed = false;
  for (const [index, questionId] of questionIds.entries()) {
    const stageIndex = getDailyStageIndex(index);
    if (stageIndex !== currentStageIndex) {
      currentStageIndex = stageIndex;
      maximum = DAILY_STAGES[stageIndex].wrongLimit;
      remaining = maximum;
    }
    const answer = answers[questionId];
    if (!answer) break;
    if (!answer.correct) {
      streak = 0;
      if (!protectedIds.has(questionId)) {
        remaining = Math.max(0, remaining - 1);
      }
      if (remaining === 0) {
        failed = true;
        break;
      }
    } else {
      streak += 1;
      if (streak === DAILY_HEAL_STREAK) {
        if (remaining < maximum) {
          remaining += 1;
          restored += 1;
        } else {
          relicsEarned += 1;
        }
        streak = 0;
      }
    }

    const { start, end } = getDailyStageBounds(stageIndex);
    if (index + 1 === end) {
      const stageIds = questionIds.slice(start, end);
      if (stageIds.every((id) => answers[id]?.correct)) relicsEarned += 1;
    }
  }

  const requestedStageIndex = getDailyStageIndex(questionIndex);
  if (!failed && requestedStageIndex !== currentStageIndex) {
    currentStageIndex = requestedStageIndex;
    maximum = DAILY_STAGES[currentStageIndex].wrongLimit;
    remaining = maximum;
  }
  return {
    remaining,
    maximum,
    restored,
    streak,
    relicsEarned,
    stageIndex: currentStageIndex,
    failed,
  };
}

export function getDailyRelicInventory(
  questionIds: readonly string[],
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
  relicUses: Readonly<Partial<Record<string, DailyRelicType>>> = {},
  protectedWrongIds: readonly string[] = [],
) {
  const inventory = Object.fromEntries(
    DAILY_RELIC_TYPES.map((type) => [type, 0]),
  ) as Record<DailyRelicType, number>;
  const { relicsEarned } = getDailyLifeState(
    questionIds,
    answers,
    protectedWrongIds,
  );
  for (let index = 0; index < relicsEarned; index += 1) {
    inventory[DAILY_RELIC_TYPES[index % DAILY_RELIC_TYPES.length]] += 1;
  }
  Object.values(relicUses).forEach((type) => {
    if (type) inventory[type] = Math.max(0, inventory[type] - 1);
  });
  return inventory;
}

export function getDailyRemainingTimeMs(
  deadlineMs: number | undefined,
  nowMs = Date.now(),
) {
  if (!deadlineMs) return DAILY_QUESTION_SECONDS * 1000;
  return Math.max(0, deadlineMs - nowMs);
}

/** The timed HP is this question's danger meter, not an additional mistake penalty. */
export function getDailyCombatState(session: DailyPracticeSession, nowMs = Date.now()) {
  const index = session.status === 'practice'
    ? Math.max(0, Math.min(session.currentIndex, session.questionIds.length - 1))
    : Math.max(0, session.currentIndex - 1);
  const stageIndex = getDailyStageIndex(index);
  const stage = DAILY_STAGES[stageIndex];
  const { start, end } = getDailyStageBounds(stageIndex);
  const ids = session.questionIds.slice(start, end);
  const answer = session.answers[session.questionIds[index]];
  const active = session.status === 'practice' && Boolean(session.questionIds[session.currentIndex]) && !answer;
  const bossRemaining = session.status === 'completed' ? 0 : stage.questions - ids.filter(
    id => session.answers[id]?.correct || session.reviewedWrongIds.includes(id),
  ).length;
  const enraged = bossRemaining > 0 && bossRemaining <= Math.ceil(stage.questions / 3);
  const cycleMs = enraged ? 5000 : stageIndex >= 4 ? 6000 : 8000;
  const remainingMs = getDailyRemainingTimeMs(session.questionDeadlineMs, nowMs);
  const elapsedMs = Math.max(0, DAILY_QUESTION_SECONDS * 1000 - remainingMs);
  const castProgress = (elapsedMs % cycleMs) / cycleMs;
  const guarding = Boolean(
    (session.barrierUntilMs ?? 0) > nowMs || (session.guardUntilMs ?? 0) > nowMs,
  );
  const life = getDailyLifeState(session.questionIds, session.answers, session.protectedWrongIds, index);
  const timeRatio = active ? Math.min(1, remainingMs / (DAILY_QUESTION_SECONDS * 1000)) : 1;
  let chain = 0;
  for (const id of ids.filter(id => session.answers[id]).reverse()) {
    if (!session.answers[id].correct) break;
    chain += 1;
  }
  return {
    active, guarding, enraged, chain, bossRemaining, cycleMs, castProgress,
    attackNumber: Math.floor(elapsedMs / cycleMs),
    skill: DAILY_BOSS_SKILLS[stageIndex],
    timedHpRatio: session.status === 'failed' ? 0 : life.remaining / life.maximum * timeRatio,
    guardAvailable: active && !Object.keys(session.guardUses ?? {}).some(
      id => getDailyStageIndex(session.questionIds.indexOf(id)) === stageIndex,
    ),
  };
}

export function activateDailyGuard(session: DailyPracticeSession, nowMs = Date.now()): DailyPracticeSession {
  const combat = getDailyCombatState(session, nowMs);
  if (!combat.guardAvailable || getDailyRemainingTimeMs(session.questionDeadlineMs, nowMs) <= 0) return session;
  const perfect = combat.castProgress >= .65;
  const questionId = session.questionIds[session.currentIndex];
  return {
    ...session,
    guardUses: { ...session.guardUses, [questionId]: perfect ? 'perfect' : 'early' },
    guardUntilMs: perfect ? nowMs + DAILY_GUARD_WINDOW_MS : undefined,
    questionDeadlineMs: (session.questionDeadlineMs ?? nowMs + DAILY_QUESTION_SECONDS * 1000)
      + (perfect ? 5 : 2) * 1000,
  };
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
    relicUses: {},
    protectedWrongIds: [],
    guardUses: {},
    currentIndex: 0,
    unreviewedWrongIds: [],
    reviewedWrongIds: [],
    status: 'practice',
  };
}

function isDailyAnswer(value: unknown): value is DailyPracticeAnswer {
  if (!value || typeof value !== 'object') return false;
  const answer = value as Partial<DailyPracticeAnswer>;
  return Number.isInteger(answer.selected) &&
    typeof answer.correct === 'boolean' &&
    (answer.timedOut === undefined || typeof answer.timedOut === 'boolean');
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
  const legacySession = session as Partial<DailyPracticeSession> & {
    timerFrozenUntilMs?: number;
    relicUses?: Record<string, string>;
  };
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
  const storedRelicUses: Record<string, string> =
    (value as { relicUses?: Record<string, string> }).relicUses ?? {};
  const relicUses: DailyPracticeSession['relicUses'] = Object.fromEntries(
    Object.entries(storedRelicUses).flatMap<[string, DailyRelicType]>(([id, type]) => {
      if (!questionIds.includes(id)) return [];
      if (type === 'eliminate') return [[id, 'eliminate']];
      if (['barrier', 'time', 'freeze', 'shield'].includes(String(type))) {
        return [[id, 'barrier']];
      }
      return [];
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
  const protectedWrongIds = [
    ...new Set([
      ...validWrongIds(session.protectedWrongIds),
      ...Object.entries(storedRelicUses).flatMap(([id, type]) =>
        type === 'shield' && answers[id] && !answers[id].correct ? [id] : [],
      ),
    ]),
  ];
  const currentIndex = Math.min(
    Math.max(0, session.currentIndex as number),
    questionIds.length,
  );
  // One guard per stage, including after a reload. Ignore unknown/duplicate entries.
  const guardUses: NonNullable<DailyPracticeSession['guardUses']> = {};
  const guardedStages = new Set<number>();
  for (const [index, id] of questionIds.entries()) {
    const use = session.guardUses?.[id];
    const stageIndex = getDailyStageIndex(index);
    if ((use === 'early' || use === 'perfect') && !guardedStages.has(stageIndex)) {
      guardUses[id] = use;
      guardedStages.add(stageIndex);
    }
  }
  const lifeState = getDailyLifeState(
    questionIds,
    answers,
    protectedWrongIds,
    Math.max(0, Math.min(
      session.status === 'failed' && !answers[questionIds[currentIndex]]
        ? currentIndex - 1
        : currentIndex,
      questionIds.length - 1,
    )),
  );
  const status = session.status === 'completed'
    ? 'completed'
    : lifeState.failed || Object.values(answers).some((answer) => answer.timedOut)
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
    relicUses,
    protectedWrongIds,
    guardUses,
    guardUntilMs: Object.values(guardUses).includes('perfect') && Number.isFinite(session.guardUntilMs)
      ? session.guardUntilMs
      : undefined,
    questionDeadlineMs: Number.isFinite(session.questionDeadlineMs)
      ? session.questionDeadlineMs
      : undefined,
    barrierUntilMs: Number.isFinite(session.barrierUntilMs)
      ? session.barrierUntilMs
      : Number.isFinite(legacySession.timerFrozenUntilMs)
        ? legacySession.timerFrozenUntilMs
      : undefined,
    currentIndex,
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
  void wrongCount;
  const stageBoundaries = DAILY_STAGES.reduce<number[]>((boundaries, stage) => {
    boundaries.push((boundaries.at(-1) ?? 0) + stage.questions);
    return boundaries;
  }, []);
  return (
    nextIndex > 0 &&
    (stageBoundaries.includes(nextIndex) || nextIndex >= total)
  );
}
