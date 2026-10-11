import { isSubjectId, pickRandomItems } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';

export const DAILY_PRACTICE_STORAGE_KEY = 'shaneweb:daily-practice';
export const DAILY_COMPLETION_STORAGE_KEY = 'shaneweb:daily-completions';
export const DAILY_QUESTIONS_PER_SUBJECT = 50;
export const DAILY_COMBO_STREAK = 3;
export const DAILY_QUESTION_SECONDS = 60;
export const DAILY_BARRIER_SECONDS = 10;
export const DAILY_GUARD_WINDOW_MS = 3000;
export const DAILY_MAX_HP = 100;
export const DAILY_HP_DRAIN_PER_SECOND = .5;
export const DAILY_CORRECT_HEAL = 15;
export const DAILY_WRONG_DAMAGE = 10;
// 50 correct + at most 23 survivable mistakes, plus the terminal mistake.
export const DAILY_MAX_RUN_QUESTIONS = 74;
export type DailyMode = 'normal' | 'adventure';

const themedBosses = {
  law: [
    ['建築法', '建照印章獸', '裁決印章'],
    ['公寓大廈管理條例', '公寓管家獸', '鑰匙旋風'],
    ['國土・區域・國家公園', '國土山林靈', '山林結界'],
    ['營造業法・採購法', '契約工務獸', '契約封印'],
    ['都市計畫・都市更新', '都市更新獅', '都市重構'],
    ['建築技術規則', '技規法典龍', '法典龍息'],
  ],
  env: [
    ['風之庭', '旋風精靈', '旋風衝擊'], ['光之廊', '日光稜晶獸', '稜光閃擊'],
    ['水之渠', '水滴管管獸', '水流湧動'], ['音之殿', '回聲音波獸', '回聲震波'],
    ['設備工坊', '空調機械獸', '風管過載'], ['綠建築森林', '綠建築森龍', '森綠龍息'],
  ],
} as const;

export function getDailyStageTheme(subject: SubjectId, stageIndex: number) {
  const index = Math.max(0, Math.min(stageIndex, DAILY_STAGE_COUNT - 1));
  const theme = subject === 'law' || subject === 'env' ? themedBosses[subject][index] : undefined;
  return {
    ...DAILY_STAGES[index], name: theme?.[0] ?? DAILY_STAGES[index].name,
    boss: theme?.[1] ?? DAILY_STAGES[index].boss,
    skill: theme?.[2] ?? DAILY_BOSS_SKILLS[index],
    sprite: theme ? `/daily-game/${subject}-boss-${index + 1}-v3.webp` : `/daily-game/boss-${index + 1}-v2.webp`,
    facing: theme || index === 5 ? 1 : -1,
  };
}

export const DAILY_BOSS_SKILLS = [
  '紅磚投擲', '鋼梁橫掃', '鷹架震擊', '玻璃風刃', '地基震波', '屋頂龍息',
] as const;

export const DAILY_STAGES = [
  { name: '磚造巷口', boss: '砌縫咕嚕', questions: 5, wrongLimit: 7 },
  { name: '鋼構工地', boss: '鋼梁鉗獸', questions: 6, wrongLimit: 6 },
  { name: '鷹架高塔', boss: '鷹架巨像', questions: 7, wrongLimit: 5 },
  { name: '玻璃天際', boss: '帷幕幽靈', questions: 8, wrongLimit: 4 },
  { name: '混凝土要塞', boss: '鋼筋堡壘獸', questions: 9, wrongLimit: 4 },
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
  rulesVersion?: 3;
  mode?: DailyMode;
  hp?: number;
  hpUpdatedAtMs?: number;
  questionRemainingMs?: number;
  failureReason?: 'time' | 'health' | 'mistakes' | 'questions';
  migrated?: boolean;
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

export function getDailyStageIndex(correctCount: number) {
  const safeIndex = Math.max(0, Math.min(correctCount, DAILY_QUESTIONS_PER_SUBJECT - 1));
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

/** Stages advance on correct answers, never on attempted-question boundaries. */
export function getDailyStagesState(
  questionIds: readonly string[],
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
) {
  const stages = DAILY_STAGES.map(() => ({ correct: 0, wrong: 0, answered: 0 }));
  const answerStages: Record<string, number> = {};
  let totalCorrect = 0;
  let streak = 0;
  let relicsEarned = 0;
  let failedAt: number | undefined;
  for (const id of questionIds) {
    const answer = answers[id];
    if (!answer) break;
    const index = getDailyStageIndex(totalCorrect);
    const stage = stages[index];
    answerStages[id] = index;
    stage.answered++;
    if (answer.correct) {
      stage.correct++;
      totalCorrect++;
      streak++;
      if (streak % DAILY_COMBO_STREAK === 0) relicsEarned++;
      if (stage.correct === DAILY_STAGES[index].questions) {
        if (stage.wrong === 0) relicsEarned++;
        streak = 0;
      }
    } else {
      stage.wrong++;
      streak = 0;
      if (stage.wrong >= DAILY_STAGES[index].wrongLimit) {
        failedAt = index;
        break;
      }
    }
  }
  return { stages, answerStages, totalCorrect, streak, relicsEarned, failedAt };
}

export function getDailyRunState(session: DailyPracticeSession) {
  const progress = getDailyStagesState(session.questionIds, session.answers);
  const currentId = session.questionIds[session.currentIndex];
  const previousId = session.questionIds[Math.max(0, session.currentIndex - 1)];
  const stageIndex = progress.failedAt ?? (
    session.status === 'completed' ? DAILY_STAGE_COUNT - 1
      : session.status === 'review' || session.status === 'failed'
        ? progress.answerStages[previousId] ?? getDailyStageIndex(progress.totalCorrect)
        : progress.answerStages[currentId] ?? getDailyStageIndex(progress.totalCorrect)
  );
  const stage = DAILY_STAGES[stageIndex];
  const counts = progress.stages[stageIndex];
  return { ...progress, stageIndex, bossRemaining: Math.max(0, stage.questions - counts.correct),
    remaining: Math.max(0, stage.wrongLimit - counts.wrong), maximum: stage.wrongLimit,
    failed: progress.failedAt !== undefined };
}


export function getDailyRelicInventory(
  questionIds: readonly string[],
  answers: Readonly<Record<string, DailyPracticeAnswer>>,
  relicUses: Readonly<Partial<Record<string, DailyRelicType>>> = {},
  protectedWrongIds: readonly string[] = [],
) {
  void protectedWrongIds;
  const inventory = { eliminate: 0, barrier: 0 };
  const { relicsEarned } = getDailyStagesState(questionIds, answers);
  for (let index = 0; index < relicsEarned; index++) inventory[DAILY_RELIC_TYPES[index % 2]]++;
  for (const type of Object.values(relicUses)) if (type) inventory[type] = Math.max(0, inventory[type] - 1);
  return inventory;
}

export function getDailyHealth(session: DailyPracticeSession, nowMs = Date.now()) {
  if (session.status === 'failed' && session.failureReason !== 'questions') return 0;
  const hp = session.hp ?? DAILY_MAX_HP;
  if (session.mode === 'normal' || session.hpUpdatedAtMs === undefined || session.status !== 'practice' ||
    session.answers[session.questionIds[session.currentIndex]]) return hp;
  const protectedUntil = Math.max(session.barrierUntilMs ?? 0, session.guardUntilMs ?? 0);
  const pausedMs = Math.max(0, Math.min(nowMs, protectedUntil) - session.hpUpdatedAtMs);
  const elapsedMs = Math.max(0, nowMs - session.hpUpdatedAtMs - pausedMs);
  return Math.max(0, hp - elapsedMs / 1000 * DAILY_HP_DRAIN_PER_SECOND);
}

export function settleDailyHealth(session: DailyPracticeSession, nowMs = Date.now()): DailyPracticeSession {
  return { ...session, hp: getDailyHealth(session, nowMs), hpUpdatedAtMs: nowMs };
}

export function getDailyRemainingTimeMs(
  deadlineMs: number | undefined,
  nowMs = Date.now(),
) {
  if (!deadlineMs) return DAILY_QUESTION_SECONDS * 1000;
  return Math.max(0, deadlineMs - nowMs);
}

export function getDailyCombatState(session: DailyPracticeSession, nowMs = Date.now()) {
  const run = getDailyRunState(session);
  const id = session.questionIds[session.currentIndex];
  const active = session.mode !== 'normal' && session.status === 'practice' && Boolean(id) &&
    !session.answers[id] && session.questionDeadlineMs !== undefined && session.hpUpdatedAtMs !== undefined;
  const enraged = run.bossRemaining > 0 && run.bossRemaining <= Math.ceil(DAILY_STAGES[run.stageIndex].questions / 3);
  const cycleMs = enraged ? 5000 : run.stageIndex >= 4 ? 6000 : 8000;
  const elapsedMs = Math.max(0, DAILY_QUESTION_SECONDS * 1000 - getDailyRemainingTimeMs(session.questionDeadlineMs, nowMs));
  const guarding = Math.max(session.barrierUntilMs ?? 0, session.guardUntilMs ?? 0) > nowMs;
  let chain = 0;
  const ids = session.questionIds.filter(qid => run.answerStages[qid] === run.stageIndex && session.answers[qid]);
  for (const qid of ids.reverse()) { if (!session.answers[qid].correct) break; chain++; }
  return { active, guarding, enraged, chain, bossRemaining: run.bossRemaining, cycleMs,
    castProgress: elapsedMs % cycleMs / cycleMs, attackNumber: Math.floor(elapsedMs / cycleMs),
    skill: getDailyStageTheme(session.subjects[0], run.stageIndex).skill,
    timedHpRatio: getDailyHealth(session, nowMs) / DAILY_MAX_HP,
    guardAvailable: active && !Object.keys(session.guardUses ?? {}).some(qid => (
      run.answerStages[qid] ?? (qid === id ? run.stageIndex : -1)
    ) === run.stageIndex) };
}

export function activateDailyGuard(session: DailyPracticeSession, nowMs = Date.now()): DailyPracticeSession {
  const combat = getDailyCombatState(session, nowMs);
  if (!combat.guardAvailable || getDailyRemainingTimeMs(session.questionDeadlineMs, nowMs) <= 0 || getDailyHealth(session, nowMs) <= 0) return session;
  const perfect = combat.castProgress >= .65;
  const questionId = session.questionIds[session.currentIndex];
  return { ...settleDailyHealth(session, nowMs),
    guardUses: { ...session.guardUses, [questionId]: perfect ? 'perfect' : 'early' },
    guardUntilMs: perfect ? nowMs + DAILY_GUARD_WINDOW_MS : undefined,
    questionDeadlineMs: (session.questionDeadlineMs ?? nowMs + DAILY_QUESTION_SECONDS * 1000) + (perfect ? 5 : 2) * 1000 };
}

export function startDailyQuestion(session: DailyPracticeSession, nowMs = Date.now()): DailyPracticeSession {
  return { ...session, hpUpdatedAtMs: session.mode === 'normal' ? undefined : nowMs,
    questionDeadlineMs: session.mode === 'normal' ? undefined : nowMs + (session.questionRemainingMs ?? DAILY_QUESTION_SECONDS * 1000),
    questionRemainingMs: undefined,
    barrierUntilMs: (session.barrierUntilMs ?? 0) > nowMs ? session.barrierUntilMs : undefined,
    guardUntilMs: undefined };
}

export function pauseDailyQuestion(session: DailyPracticeSession, nowMs = Date.now()): DailyPracticeSession {
  if (session.mode === 'normal' || session.status !== 'practice' || !session.questionDeadlineMs ||
    session.answers[session.questionIds[session.currentIndex]]) return session;
  return { ...settleDailyHealth(session, nowMs), hpUpdatedAtMs: undefined,
    questionRemainingMs: getDailyRemainingTimeMs(session.questionDeadlineMs, nowMs), questionDeadlineMs: undefined };
}

export function answerDailyQuestion(session: DailyPracticeSession, selected: number, correct: boolean, nowMs = Date.now()): DailyPracticeSession {
  const id = session.questionIds[session.currentIndex];
  if (!id || session.status !== 'practice' || session.answers[id]) return session;
  const normal = session.mode === 'normal';
  const health = getDailyHealth(session, nowMs);
  const timedOut = !normal && getDailyRemainingTimeMs(session.questionDeadlineMs, nowMs) <= 0;
  if (!normal && (timedOut || health <= 0)) {
    return { ...session, hp: 0, hpUpdatedAtMs: undefined, questionDeadlineMs: undefined,
      answers: { ...session.answers, [id]: { selected: -1, correct: false, timedOut: true } },
      unreviewedWrongIds: [...session.unreviewedWrongIds, id], currentIndex: session.currentIndex + 1,
      status: 'failed', failureReason: timedOut ? 'time' : 'health' };
  }
  const protectedHit = !correct && !normal && getDailyCombatState(session, nowMs).guarding;
  const hp = normal ? health : Math.max(0, Math.min(DAILY_MAX_HP,
    health + (correct ? DAILY_CORRECT_HEAL : protectedHit ? 0 : -DAILY_WRONG_DAMAGE)));
  const next: DailyPracticeSession = { ...session, hp, hpUpdatedAtMs: undefined, questionDeadlineMs: undefined,
    answers: { ...session.answers, [id]: { selected, correct } },
    unreviewedWrongIds: correct ? session.unreviewedWrongIds : [...session.unreviewedWrongIds, id],
    protectedWrongIds: protectedHit ? [...session.protectedWrongIds, id] : session.protectedWrongIds };
  const run = getDailyRunState(next);
  if (!normal && (run.failed || hp <= 0)) {
    return { ...next, currentIndex: session.currentIndex + 1, status: 'failed', hp: 0,
      failureReason: run.failed ? 'mistakes' : 'health' };
  }
  return next;
}

export function advanceDailyQuestion(session: DailyPracticeSession): DailyPracticeSession {
  const id = session.questionIds[session.currentIndex];
  if (session.status !== 'practice' || !session.answers[id]) return session;
  const run = getDailyRunState(session);
  const nextIndex = session.currentIndex + 1;
  if (session.mode !== 'normal' && run.bossRemaining === 0) {
    return { ...session, currentIndex: nextIndex, status: 'review', hpUpdatedAtMs: undefined,
      questionDeadlineMs: undefined, barrierUntilMs: undefined, guardUntilMs: undefined };
  }
  const exhausted = nextIndex >= session.questionIds.length;
  return { ...session, currentIndex: nextIndex, status: exhausted ? session.mode === 'normal' ? 'completed' : 'failed' : 'practice',
    failureReason: exhausted && session.mode !== 'normal' ? 'questions' : undefined,
    hpUpdatedAtMs: undefined, questionDeadlineMs: undefined,
    barrierUntilMs: exhausted ? undefined : session.barrierUntilMs, guardUntilMs: undefined };
}

export function finishDailyStageReview(session: DailyPracticeSession): DailyPracticeSession {
  if (session.status !== 'review' || !session.unreviewedWrongIds.every(id => session.reviewedWrongIds.includes(id))) return session;
  const completed = session.mode === 'normal' ? session.currentIndex >= session.questionIds.length
    : getDailyRunState(session).totalCorrect >= DAILY_QUESTIONS_PER_SUBJECT;
  const exhausted = !completed && session.currentIndex >= session.questionIds.length;
  return { ...session, status: completed ? 'completed' : exhausted ? 'failed' : 'practice',
    failureReason: exhausted ? 'questions' : undefined, unreviewedWrongIds: [], reviewedWrongIds: [],
    hpUpdatedAtMs: undefined, questionDeadlineMs: undefined, barrierUntilMs: undefined, guardUntilMs: undefined };
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
  mode: DailyMode = 'adventure',
): DailyPracticeSession {
  const selectedSubjects = [...new Set(subjects)].slice(0, 1);
  const questionIds = selectedSubjects.flatMap((subject) =>
    pickRandomItems(
      questions.filter(
        (question) =>
          question.subject === subject && question.answerKey.kind !== 'written',
      ),
      mode === 'normal' ? DAILY_QUESTIONS_PER_SUBJECT : DAILY_MAX_RUN_QUESTIONS,
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
    rulesVersion: 3,
    mode,
    hp: DAILY_MAX_HP,
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
  const maximumQuestions = DAILY_MAX_RUN_QUESTIONS;
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
  const versioned = session.rulesVersion === 3;
  // Pre-1.63 runs have incompatible attempted-question stage boundaries. Preserve
  // their answers in normal mode rather than inventing a new victory or deleting data.
  const mode: DailyMode = versioned && session.mode === 'adventure' ? 'adventure' : 'normal';
  const base: DailyPracticeSession = {
    rulesVersion: 3, mode, migrated: !versioned || session.migrated || undefined,
    date: session.date, subjects, questionIds, optionOrders, answers, eliminatedOptions,
    relicUses, protectedWrongIds, currentIndex, unreviewedWrongIds, reviewedWrongIds,
    status: session.status as DailyPracticeSession['status'],
    hp: Number.isFinite(session.hp) ? Math.max(0, Math.min(DAILY_MAX_HP, session.hp!)) : DAILY_MAX_HP,
    hpUpdatedAtMs: mode === 'adventure' && Number.isFinite(session.hpUpdatedAtMs) ? session.hpUpdatedAtMs : undefined,
    questionRemainingMs: mode === 'adventure' && Number.isFinite(session.questionRemainingMs)
      ? Math.max(0, Math.min(DAILY_QUESTION_SECONDS * 1000 + 15000, session.questionRemainingMs!)) : undefined,
    questionDeadlineMs: mode === 'adventure' && Number.isFinite(session.questionDeadlineMs) ? session.questionDeadlineMs : undefined,
    barrierUntilMs: mode === 'adventure' && Number.isFinite(session.barrierUntilMs)
      ? session.barrierUntilMs : mode === 'adventure' && Number.isFinite(legacySession.timerFrozenUntilMs)
        ? legacySession.timerFrozenUntilMs : undefined,
    failureReason: ['time', 'health', 'mistakes', 'questions'].includes(session.failureReason ?? '')
      ? session.failureReason : undefined,
  };
  const run = getDailyRunState(base);
  const guardUses: NonNullable<DailyPracticeSession['guardUses']> = {};
  const guardedStages = new Set<number>();
  for (const id of questionIds) {
    const use = session.guardUses?.[id];
    const stageIndex = run.answerStages[id] ?? (id === questionIds[currentIndex] ? run.stageIndex : -1);
    if (stageIndex >= 0 && (use === 'early' || use === 'perfect') && !guardedStages.has(stageIndex)) {
      guardUses[id] = use;
      guardedStages.add(stageIndex);
    }
  }
  base.guardUses = guardUses;
  base.guardUntilMs = mode === 'adventure' && Object.values(guardUses).includes('perfect') && Number.isFinite(session.guardUntilMs)
    ? session.guardUntilMs : undefined;
  if (mode === 'adventure') {
    if (run.failed) { base.status = 'failed'; base.failureReason = 'mistakes'; base.hp = 0; }
    if (Object.values(answers).some(answer => answer.timedOut)) {
      base.status = 'failed'; base.failureReason ??= 'time'; base.hp = 0;
    }
    // Reloading a defeated run must never resurrect it. Completion requires 50 correct.
    if (base.status === 'failed') base.failureReason ??= 'health';
    if (base.status === 'completed' && run.totalCorrect < DAILY_QUESTIONS_PER_SUBJECT) {
      base.status = currentIndex < questionIds.length ? 'practice' : 'failed';
      if (base.status === 'failed') base.failureReason = 'questions';
    }
    if (base.status === 'practice' && currentIndex >= questionIds.length) {
      base.status = run.totalCorrect >= DAILY_QUESTIONS_PER_SUBJECT ? 'completed' : 'failed';
      if (base.status === 'failed') base.failureReason = 'questions';
    }
  }
  return base;
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
        result.answered <= DAILY_MAX_RUN_QUESTIONS &&
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
