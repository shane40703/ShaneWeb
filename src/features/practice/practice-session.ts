import { getTaipeiDateKey, type DailyPaper } from '@/features/daily/daily-paper';
import {
  formatCorrectAnswer,
  getAnalysisCategory,
  isQuestionCorrect,
  isSubjectId,
  pickRandomItems,
} from '@/lib/study';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import { getSubject, years } from '@/question-bank/catalog';
import { analysisCategoryCatalog } from '@/question-bank/schema';
import { practiceQuizPage } from './practice-pages';

export const PRACTICE_PATH = practiceQuizPage.href;
export const PRACTICE_SESSION_STORAGE_KEY = 'shaneweb:practice-session';
export const PRACTICE_COUNT_OPTIONS = [5, 10, 15, 20, 30, 50] as const;
const MAX_PRACTICE_COUNT = PRACTICE_COUNT_OPTIONS[PRACTICE_COUNT_OPTIONS.length - 1];

export function practiceQuestionHref(index: number) {
  return `${PRACTICE_PATH}?q=${index + 1}`;
}

/** Everything except the subject. The defaults reproduce the original daily practice. */
export interface PracticeSettings {
  /** Unset means the earliest year that has questions. */
  fromYear?: number;
  /** Unset means the latest year that has questions. */
  toYear?: number;
  category: string;
  count: number;
  shuffleOptions: boolean;
  includeAllCredit: boolean;
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  category: 'all',
  count: MAX_PRACTICE_COUNT,
  shuffleOptions: true,
  includeAllCredit: false,
};

export function isDefaultPracticeSettings(settings: PracticeSettings) {
  return (
    settings.fromYear === undefined &&
    settings.toYear === undefined &&
    settings.category === DEFAULT_PRACTICE_SETTINGS.category &&
    settings.count === DEFAULT_PRACTICE_SETTINGS.count &&
    settings.shuffleOptions === DEFAULT_PRACTICE_SETTINGS.shuffleOptions &&
    settings.includeAllCredit === DEFAULT_PRACTICE_SETTINGS.includeAllCredit
  );
}

/** 一律給分, including keys that accept every option, which grade the same way. */
function isAllCreditQuestion(question: Pick<Question, 'options' | 'answerKey'>) {
  return (
    question.answerKey.kind === 'all-credit' ||
    (question.answerKey.kind === 'accepted' &&
      question.answerKey.options.length >= question.options.length)
  );
}

function isPracticeQuestion(question: Question) {
  if (question.format === 'written' || question.answerKey.kind === 'written')
    return false;
  if (!question.options.length) return false;
  return !(question.answerKey.kind === 'accepted' && !question.answerKey.options.length);
}

// Placeholders left in the bank's law tags; such questions use their topic category.
const PLACEHOLDER_CATEGORIES = new Set(['???', '？？？', '廢止']);

function normalizeCategory(name: string) {
  // Folds CJK compatibility ideographs, so one law is never listed twice.
  return name.normalize('NFC').trim();
}

/** The question's law categories, cleaned for display and filtering on this page only. */
export function getPracticeCategories(
  question: Pick<Question, 'subject' | 'topic' | 'primaryCategory' | 'relatedLaws'>,
) {
  const laws = [
    ...new Set(
      (question.relatedLaws ?? [])
        .map(normalizeCategory)
        .filter((law) => law && !PLACEHOLDER_CATEGORIES.has(law)),
    ),
  ];
  return laws.length
    ? laws
    : [
        normalizeCategory(
          getAnalysisCategory(question.subject, question.topic, question.primaryCategory),
        ),
      ];
}

/**
 * The 每日抽題練習 category that covers most of these questions, for links from pages that
 * group questions their own way (考題分析). Ties go to the name the page showed.
 */
export function practiceCategoryFor(
  questions: readonly Pick<
    Question,
    'subject' | 'topic' | 'primaryCategory' | 'relatedLaws'
  >[],
  shown?: string,
) {
  const counts = new Map<string, number>();
  questions.forEach((question) =>
    getPracticeCategories(question).forEach((category) =>
      counts.set(category, (counts.get(category) ?? 0) + 1),
    ),
  );
  const preferred = shown ? normalizeCategory(shown) : null;
  return (
    [...counts.entries()].sort(
      ([leftName, left], [rightName, right]) =>
        right - left || Number(rightName === preferred) - Number(leftName === preferred),
    )[0]?.[0] ?? null
  );
}

export interface PracticeCategory {
  name: string;
  count: number;
}

export interface PracticePool {
  /** The subject's questions under the 一律給分 setting, across every year. */
  eligibleCount: number;
  availableYears: number[];
  /** As chosen, so the selects keep showing a reversed range. */
  fromYear: number;
  toYear: number;
  rangeStart: number;
  rangeEnd: number;
  rangeCandidates: Question[];
  /** 一律給分 questions in the year range, whether or not they are included. */
  allCreditInRange: number;
  categories: PracticeCategory[];
  category: string;
  candidates: Question[];
  countOptions: number[];
  count: number;
}

/** Applies the settings in order: subject, 一律給分, year range, category, count. */
export function resolvePracticePool(
  questions: readonly Question[],
  subject: SubjectId,
  settings: PracticeSettings,
): PracticePool {
  const subjectQuestions = questions.filter(
    (question) => question.subject === subject && isPracticeQuestion(question),
  );
  const eligible = settings.includeAllCredit
    ? subjectQuestions
    : subjectQuestions.filter((question) => !isAllCreditQuestion(question));
  const availableYears = years.filter((year) =>
    eligible.some((question) => question.year === year),
  );
  const fromYear =
    settings.fromYear !== undefined && availableYears.includes(settings.fromYear)
      ? settings.fromYear
      : (availableYears.at(-1) ?? years.at(-1)!);
  const toYear =
    settings.toYear !== undefined && availableYears.includes(settings.toYear)
      ? settings.toYear
      : (availableYears[0] ?? years[0]);
  const rangeStart = Math.min(fromYear, toYear);
  const rangeEnd = Math.max(fromYear, toYear);
  const inRange = (question: Question) =>
    question.year >= rangeStart && question.year <= rangeEnd;
  const rangeCandidates = eligible.filter(inRange);
  const allCreditInRange = subjectQuestions.filter(
    (question) => inRange(question) && isAllCreditQuestion(question),
  ).length;

  const categoriesById = new Map(
    rangeCandidates.map((question) => [question.id, getPracticeCategories(question)]),
  );
  const categoryCounts = new Map<string, number>();
  categoriesById.forEach((categories) => {
    categories.forEach((category) => {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    });
  });
  const catalog = analysisCategoryCatalog[subject];
  const categoryNames = [
    ...Object.keys(catalog).filter((category) => categoryCounts.has(category)),
    ...[...categoryCounts.keys()]
      .filter((category) => !(category in catalog))
      .sort((left, right) => left.localeCompare(right, 'zh-Hant')),
  ];
  const category = categoryNames.includes(settings.category) ? settings.category : 'all';
  const candidates =
    category === 'all'
      ? rangeCandidates
      : rangeCandidates.filter((question) =>
          categoriesById.get(question.id)!.includes(category),
        );

  // A pool smaller than the largest option offers "all of it", so the default
  // of 50 still means "up to 50" like the original daily practice.
  const countOptions: number[] = PRACTICE_COUNT_OPTIONS.filter(
    (count) => count <= candidates.length,
  );
  if (
    candidates.length &&
    candidates.length < MAX_PRACTICE_COUNT &&
    !countOptions.includes(candidates.length)
  ) {
    countOptions.push(candidates.length);
  }
  const count = countOptions.includes(settings.count)
    ? settings.count
    : (countOptions.filter((option) => option <= settings.count).at(-1) ??
      countOptions.at(-1) ??
      0);

  return {
    eligibleCount: eligible.length,
    availableYears,
    fromYear,
    toYear,
    rangeStart,
    rangeEnd,
    rangeCandidates,
    allCreditInRange,
    categories: categoryNames.map((name) => ({ name, count: categoryCounts.get(name)! })),
    category,
    candidates,
    countOptions,
    count,
  };
}

export interface PracticeAnswer {
  /** A displayed option index; the session's option order never changes. */
  selected: number;
  correct: boolean;
}

export interface PracticeSession {
  version: 1;
  /** Tells another tab's copy of this set apart from a different set. */
  id: string;
  subject: SubjectId;
  rangeStart: number;
  rangeEnd: number;
  category: string;
  questionIds: string[];
  /** Displayed option order per question; a missing entry keeps the original order. */
  optionOrders: Record<string, number[]>;
  /** Confirmed answers. A confirmed question is locked. */
  answers: Record<string, PracticeAnswer>;
  /** Selected but not yet confirmed. Never graded. */
  drafts: Record<string, number>;
  eliminated: Record<string, number[]>;
  elapsedSeconds: Record<string, number>;
  currentIndex: number;
  /** A whole-subject review uses the same quiz, without the random draw's count cap. */
  reviewSource?: 'difficult' | 'wrong';
}

/** All playable questions of this subject, once each and across every year. */
export function subjectReviewQuestions(questions: readonly Question[], subject: SubjectId) {
  return [...new Map(questions
    .filter(question => question.subject === subject && isPracticeQuestion(question))
    .map(question => [question.id, question])).values()]
    .sort((left, right) => right.year - left.year || left.questionNumber - right.questionNumber);
}

function createSessionId(random: () => number) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${random().toString(36).slice(2)}`
  );
}

/**
 * A new set of exactly these questions, in this order: what 再做一次 in 已作答紀錄 starts.
 * The range and category describe the questions: a category shared by all of them, else 全部.
 */
export function createPracticeSessionFromQuestions(
  questions: readonly Question[],
  subject: SubjectId,
  shuffleOptions: boolean,
  random: () => number = Math.random,
): PracticeSession {
  const questionYears = questions.map((question) => question.year);
  const [first, ...rest] = questions;
  const shared = first
    ? getPracticeCategories(first).filter((category) =>
        rest.every((question) => getPracticeCategories(question).includes(category)),
      )
    : [];
  return {
    version: 1,
    id: createSessionId(random),
    subject,
    rangeStart: questionYears.length ? Math.min(...questionYears) : years.at(-1)!,
    rangeEnd: questionYears.length ? Math.max(...questionYears) : years[0],
    category: shared[0] ?? 'all',
    questionIds: questions.map((question) => question.id),
    optionOrders: shuffleOptions
      ? Object.fromEntries(
          questions.map((question) => {
            const indexes = question.options.map((_, index) => index);
            return [question.id, pickRandomItems(indexes, indexes.length, random)];
          }),
        )
      : {},
    answers: {},
    drafts: {},
    eliminated: {},
    elapsedSeconds: {},
    currentIndex: 0,
  };
}

/** Every draw is new; nothing is cached per day or per subject. */
export function createPracticeSession(
  pool: Pick<
    PracticePool,
    'candidates' | 'count' | 'rangeStart' | 'rangeEnd' | 'category'
  >,
  subject: SubjectId,
  shuffleOptions: boolean,
  random: () => number = Math.random,
): PracticeSession {
  const picked = pickRandomItems(pool.candidates, pool.count, random);
  return {
    ...createPracticeSessionFromQuestions(picked, subject, shuffleOptions, random),
    rangeStart: pool.rangeStart,
    rangeEnd: pool.rangeEnd,
    category: pool.category,
  };
}

/** Only expose mappings that were actually applicable to this version of the question. */
export function getOriginalOptionIndexes(
  question: Pick<Question, 'options'>,
  optionOrder: readonly number[] | undefined,
) {
  return optionOrder && fitsOptions(optionOrder, question.options.length) ? optionOrder : undefined;
}

/**
 * Reorders the options and remaps the answer key, so graded indexes match the screen.
 * An order that does not fit the question (the bank changed) leaves it as it is.
 */
export function displayPracticeQuestion(
  question: Question,
  optionOrder: readonly number[] | undefined,
): Question {
  const order = getOriginalOptionIndexes(question, optionOrder);
  if (!order) return question;
  return {
    ...question,
    options: order.map((index) => question.options[index]),
    answerKey:
      question.answerKey.kind === 'accepted'
        ? {
            kind: 'accepted',
            options: question.answerKey.options.map((index) =>
              order.indexOf(index),
            ),
          }
        : question.answerKey,
  };
}

export function getDisplayedQuestion(
  session: Pick<PracticeSession, 'optionOrders'>,
  question: Question,
) {
  return displayPracticeQuestion(question, session.optionOrders[question.id]);
}

function isOpenQuestion(session: PracticeSession, questionId: string) {
  return session.questionIds.includes(questionId) && !session.answers[questionId];
}

export function selectPracticeOption(
  session: PracticeSession,
  questionId: string,
  selected: number | undefined,
) {
  if (!isOpenQuestion(session, questionId) || session.drafts[questionId] === selected)
    return session;
  const drafts = { ...session.drafts };
  if (selected === undefined) delete drafts[questionId];
  else drafts[questionId] = selected;
  return { ...session, drafts };
}

export function togglePracticeElimination(
  session: PracticeSession,
  questionId: string,
  option: number,
) {
  if (!isOpenQuestion(session, questionId) || session.drafts[questionId] === option)
    return session;
  const current = session.eliminated[questionId] ?? [];
  const next = current.includes(option)
    ? current.filter((index) => index !== option)
    : [...current, option].sort((left, right) => left - right);
  const eliminated = { ...session.eliminated };
  if (next.length) eliminated[questionId] = next;
  else delete eliminated[questionId];
  return { ...session, eliminated };
}

/** Grades the draft against the displayed (reordered) question and locks it. */
export function confirmPracticeAnswer(
  session: PracticeSession,
  displayedQuestion: Pick<Question, 'id' | 'answerKey'>,
) {
  const questionId = displayedQuestion.id;
  const selected = session.drafts[questionId];
  if (selected === undefined || !isOpenQuestion(session, questionId)) return session;
  const drafts = { ...session.drafts };
  delete drafts[questionId];
  return {
    ...session,
    drafts,
    answers: {
      ...session.answers,
      [questionId]: { selected, correct: isQuestionCorrect(displayedQuestion, selected) },
    },
  };
}

/** Time only counts while a question is still open, not while reading its explanation. */
export function tickPracticeTimer(
  session: PracticeSession,
  questionId: string,
  seconds = 1,
) {
  if (!isOpenQuestion(session, questionId) || seconds <= 0) return session;
  return {
    ...session,
    elapsedSeconds: {
      ...session.elapsedSeconds,
      [questionId]: (session.elapsedSeconds[questionId] ?? 0) + seconds,
    },
  };
}

export interface PendingPracticeTime {
  questionId: string;
  seconds: number;
}

/**
 * Seconds on the open question that are not in the session yet. The clock reads
 * them every second; the session, and so storage, only takes them in on an
 * action or when the page is hidden.
 */
export function createPracticeTimer() {
  let pending: PendingPracticeTime | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSeconds: () => pending?.seconds ?? 0,
    peek: () => pending,
    tick(questionId: string) {
      pending = {
        questionId,
        seconds: pending?.questionId === questionId ? pending.seconds + 1 : 1,
      };
      emit();
    },
    take() {
      const taken = pending;
      pending = null;
      if (taken) emit();
      return taken;
    },
    /** Drops seconds another window already counted for the same question. */
    discount(questionId: string, seconds: number) {
      if (pending?.questionId !== questionId || seconds <= 0) return;
      pending =
        pending.seconds > seconds
          ? { questionId, seconds: pending.seconds - seconds }
          : null;
      emit();
    },
  };
}

/** Answers, selections or strike-outs: work that a stale result must not wipe. */
export function hasPracticeAnswers(session: PracticeSession) {
  return [session.answers, session.drafts, session.eliminated].some(
    (record) => Object.keys(record).length > 0,
  );
}

export type PracticeTimer = ReturnType<typeof createPracticeTimer>;

export function addPracticeTime(
  session: PracticeSession,
  pending: PendingPracticeTime | null,
) {
  return pending
    ? tickPracticeTimer(session, pending.questionId, pending.seconds)
    : session;
}

export function movePracticeTo(session: PracticeSession, index: number) {
  const next = Math.max(0, Math.min(Math.trunc(index), session.questionIds.length - 1));
  return next === session.currentIndex ? session : { ...session, currentIndex: next };
}

/** The same questions and option order, with every trace of the attempt removed. */
export function resetPracticeAnswers(session: PracticeSession): PracticeSession {
  return {
    ...session,
    answers: {},
    drafts: {},
    eliminated: {},
    elapsedSeconds: {},
    currentIndex: 0,
  };
}

export function hasPracticeProgress(session: PracticeSession) {
  return [
    session.answers,
    session.drafts,
    session.eliminated,
    session.elapsedSeconds,
  ].some((record) => Object.keys(record).length > 0);
}

export interface PracticeSummary {
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  /** Rounded percentage of answered questions; null when nothing was answered. */
  accuracy: number | null;
  wrongIds: string[];
  elapsedSeconds: number;
}

/** Unanswered questions are reported but never count toward the accuracy. */
export function summarizePractice(session: PracticeSession): PracticeSummary {
  const answeredIds = session.questionIds.filter(
    (questionId) => session.answers[questionId],
  );
  const wrongIds = answeredIds.filter(
    (questionId) => !session.answers[questionId].correct,
  );
  const correct = answeredIds.length - wrongIds.length;
  return {
    total: session.questionIds.length,
    answered: answeredIds.length,
    correct,
    wrong: wrongIds.length,
    unanswered: session.questionIds.length - answeredIds.length,
    accuracy: answeredIds.length
      ? Math.round((correct / answeredIds.length) * 100)
      : null,
    wrongIds,
    elapsedSeconds: session.questionIds.reduce(
      (total, questionId) => total + (session.elapsedSeconds[questionId] ?? 0),
      0,
    ),
  };
}

/** An order that does not fit the question was never applied (see displayPracticeQuestion). */
function fitsOptions(order: readonly number[], optionCount: number) {
  return (
    order.length === optionCount &&
    new Set(order).size === optionCount &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index < optionCount)
  );
}

/** The option of the original paper behind a choice made on the (maybe shuffled) screen. */
export function toOriginalOption(
  question: Pick<Question, 'options'> | undefined,
  order: readonly number[] | undefined,
  displayed: number,
) {
  return order && fitsOptions(order, question?.options.length ?? order.length)
    ? order[displayed]
    : displayed;
}

/**
 * The 已作答紀錄 entry of a submitted set, or null when nothing was answered. Its numbers
 * are the result page's: blanks, 一律給分 included, never count. Answers are stored in the
 * original option order, like every other record.
 */
export function createPracticeAttempt(
  session: PracticeSession,
  questionById: ReadonlyMap<string, Pick<Question, 'options'>>,
  submittedAt = new Date().toISOString(),
): { attempt: QuizAttempt; results: Record<string, boolean> } | null {
  const summary = summarizePractice(session);
  if (!summary.answered) return null;
  const answers: Record<string, number> = {};
  const results: Record<string, boolean> = {};
  session.questionIds.forEach((questionId) => {
    const answer = session.answers[questionId];
    if (!answer) return;
    answers[questionId] = toOriginalOption(
      questionById.get(questionId),
      session.optionOrders[questionId],
      answer.selected,
    );
    results[questionId] = answer.correct;
  });
  return {
    attempt: {
      id: `attempt-${submittedAt}-${Math.random().toString(36).slice(2, 8)}`,
      mode: 'practice',
      subject: session.subject,
      year: null,
      questionIds: [...session.questionIds],
      answers,
      startedAt: new Date(
        Date.parse(submittedAt) - summary.elapsedSeconds * 1000,
      ).toISOString(),
      submittedAt,
      elapsedSeconds: summary.elapsedSeconds,
      correctCount: summary.correct,
      wrongCount: summary.wrong,
      unansweredCount: summary.unanswered,
    },
    results,
  };
}

/** Keep large review sets compatible with the existing 200-question Firestore limit. */
export function createPracticeAttempts(
  session: PracticeSession,
  questionById: ReadonlyMap<string, Pick<Question, 'options'>>,
  submittedAt = new Date().toISOString(),
) {
  const records: NonNullable<ReturnType<typeof createPracticeAttempt>>[] = [];
  for (let offset = 0; offset < session.questionIds.length; offset += 200) {
    const record = createPracticeAttempt({
      ...session,
      questionIds: session.questionIds.slice(offset, offset + 200),
    }, questionById, submittedAt);
    if (!record) continue;
    if (session.questionIds.length > 200) record.attempt.id += `-part-${offset / 200 + 1}`;
    records.push(record);
  }
  return records;
}

/** Kept only in memory: a reload after submitting returns to the blank set. */
export interface PracticeResult {
  session: PracticeSession;
  summary: PracticeSummary;
}

export function createPracticeResult(session: PracticeSession): PracticeResult {
  return { session, summary: summarizePractice(session) };
}

/** Reuses the daily practice paper layout, title and answer key page. */
export function createPracticePaper(
  session: Pick<PracticeSession, 'subject' | 'questionIds' | 'optionOrders'>,
  questionById: ReadonlyMap<string, Question>,
  date = getTaipeiDateKey(),
): DailyPaper {
  const displayed = session.questionIds.map((questionId) => {
    const question = questionById.get(questionId);
    if (!question) throw new Error('題目尚未完整載入，請重新載入後再試。');
    return displayPracticeQuestion(question, session.optionOrders[questionId]);
  });
  if (!displayed.length) throw new Error('目前條件沒有可抽的題目。');
  return {
    date,
    subjectName: getSubject(session.subject)?.name ?? '',
    questions: displayed.map((question) => ({
      id: question.id,
      year: question.year,
      questionNumber: question.questionNumber,
      content: question.content,
      options: question.options,
    })),
    referenceAnswers: displayed.map((question) => formatCorrectAnswer(question)),
    // Unshuffled papers keep the exam's option order, unlike the daily default.
    ...(Object.keys(session.optionOrders).length
      ? {}
      : { answerKeyNote: '依本次每日題號對照，非原試卷題號；選項為原試卷順序。' }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function recordEntries(value: unknown) {
  return isRecord(value) ? Object.entries(value) : [];
}

/** Restores an in-progress set, dropping anything that does not parse. */
export function parsePracticeSession(raw: string | null): PracticeSession | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || !isSubjectId(value.subject)) return null;
  const questionIds = Array.isArray(value.questionIds)
    ? [
        ...new Set(
          value.questionIds.filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
        ),
      ]
    : [];
  if (!questionIds.length) return null;
  const known = new Set(questionIds);

  const optionOrders: Record<string, number[]> = {};
  for (const [questionId, order] of recordEntries(value.optionOrders)) {
    if (
      known.has(questionId) &&
      Array.isArray(order) &&
      order.length &&
      order.every(isIndex) &&
      new Set(order).size === order.length
    ) {
      optionOrders[questionId] = [...order];
    }
  }
  const answers: Record<string, PracticeAnswer> = {};
  for (const [questionId, answer] of recordEntries(value.answers)) {
    if (
      known.has(questionId) &&
      isRecord(answer) &&
      isIndex(answer.selected) &&
      typeof answer.correct === 'boolean'
    ) {
      answers[questionId] = { selected: answer.selected, correct: answer.correct };
    }
  }
  const drafts: Record<string, number> = {};
  for (const [questionId, selected] of recordEntries(value.drafts)) {
    if (known.has(questionId) && !answers[questionId] && isIndex(selected))
      drafts[questionId] = selected;
  }
  // Answered questions keep theirs too: the locked question still shows them.
  const eliminated: Record<string, number[]> = {};
  for (const [questionId, options] of recordEntries(value.eliminated)) {
    if (
      known.has(questionId) &&
      Array.isArray(options) &&
      options.length &&
      options.every(isIndex)
    ) {
      eliminated[questionId] = [...new Set(options)].sort((left, right) => left - right);
    }
  }
  const elapsedSeconds: Record<string, number> = {};
  for (const [questionId, seconds] of recordEntries(value.elapsedSeconds)) {
    if (known.has(questionId) && isIndex(seconds)) elapsedSeconds[questionId] = seconds;
  }
  const yearOf = (year: unknown, fallback: number) =>
    Number.isInteger(year) && years.includes(year as number)
      ? (year as number)
      : fallback;
  const rangeStart = yearOf(value.rangeStart, years.at(-1)!);
  const rangeEnd = yearOf(value.rangeEnd, years[0]);

  return {
    version: 1,
    id:
      typeof value.id === 'string' && value.id ? value.id : createSessionId(Math.random),
    subject: value.subject,
    rangeStart: Math.min(rangeStart, rangeEnd),
    rangeEnd: Math.max(rangeStart, rangeEnd),
    category:
      typeof value.category === 'string' && value.category ? value.category : 'all',
    questionIds,
    optionOrders,
    answers,
    drafts,
    eliminated,
    elapsedSeconds,
    currentIndex: Number.isInteger(value.currentIndex)
      ? Math.max(0, Math.min(value.currentIndex as number, questionIds.length - 1))
      : 0,
    ...(value.reviewSource === 'difficult' || value.reviewSource === 'wrong'
      ? { reviewSource: value.reviewSource }
      : {}),
  };
}
