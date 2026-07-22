import { subjects } from '@/question-bank/catalog';
import type {
  AnswerRecord,
  AppStateV3,
  AppStateV4,
  DiscussionPost,
  Question,
  QuizAttempt,
  SubjectId,
} from '@/lib/types';

export const STORAGE_KEY = 'shaneweb:v4';
export const V3_STORAGE_KEY = 'shaneweb:v3';
export const LEGACY_STORAGE_KEY = 'shaneweb:v2';

const REPLACED_QUESTION_IDS = new Set(['law-114-01', 'construction-114-01']);

export function createDefaultState(): AppStateV4 {
  return {
    version: 4,
    answers: {},
    difficultQuestionIds: [],
    attempts: [],
    notes: {},
    discussionPosts: [],
  };
}

function isAnswerRecord(value: unknown): value is AnswerRecord {
  if (!value || typeof value !== 'object') return false;
  const answer = value as Partial<AnswerRecord>;
  return (
    Number.isInteger(answer.selected) &&
    typeof answer.correct === 'boolean' &&
    typeof answer.answeredAt === 'string'
  );
}

function isQuizAttempt(value: unknown): value is QuizAttempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Partial<QuizAttempt>;
  return (
    typeof attempt.id === 'string' &&
    (attempt.mode === 'paper' || attempt.mode === 'random') &&
    typeof attempt.startedAt === 'string' &&
    typeof attempt.submittedAt === 'string' &&
    Number.isInteger(attempt.elapsedSeconds) &&
    Array.isArray(attempt.questionIds) &&
    Boolean(attempt.answers) &&
    typeof attempt.answers === 'object' &&
    Number.isInteger(attempt.correctCount) &&
    Number.isInteger(attempt.wrongCount) &&
    Number.isInteger(attempt.unansweredCount)
  );
}

function isDiscussionPost(value: unknown): value is DiscussionPost {
  if (!value || typeof value !== 'object') return false;
  const post = value as Partial<DiscussionPost>;
  return (
    typeof post.id === 'string' &&
    typeof post.questionId === 'string' &&
    ['explanation', 'supplement', 'question', 'correction'].includes(post.type ?? '') &&
    typeof post.content === 'string' &&
    typeof post.createdAt === 'string' &&
    Number.isInteger(post.likes) &&
    Array.isArray(post.replies) &&
    post.replies.every(
      (reply) =>
        Boolean(reply) &&
        typeof reply.id === 'string' &&
        typeof reply.content === 'string' &&
        typeof reply.createdAt === 'string',
    ) &&
    typeof post.reported === 'boolean'
  );
}

export function isAppStateV3(value: unknown): value is AppStateV3 {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppStateV3>;
  return (
    state.version === 3 &&
    Boolean(state.answers) &&
    typeof state.answers === 'object' &&
    Object.values(state.answers ?? {}).every(isAnswerRecord) &&
    Array.isArray(state.difficultQuestionIds) &&
    state.difficultQuestionIds.every((id) => typeof id === 'string') &&
    Array.isArray(state.attempts) &&
    state.attempts.every(isQuizAttempt) &&
    Boolean(state.notes) &&
    typeof state.notes === 'object' &&
    Object.values(state.notes ?? {}).every((note) => typeof note === 'string') &&
    Array.isArray(state.discussionPosts) &&
    state.discussionPosts.every(isDiscussionPost)
  );
}

export function isAppStateV4(value: unknown): value is AppStateV4 {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppStateV4>;
  return (
    state.version === 4 &&
    Boolean(state.answers) &&
    typeof state.answers === 'object' &&
    Object.values(state.answers ?? {}).every(isAnswerRecord) &&
    Array.isArray(state.difficultQuestionIds) &&
    state.difficultQuestionIds.every((id) => typeof id === 'string') &&
    Array.isArray(state.attempts) &&
    state.attempts.every(isQuizAttempt) &&
    Boolean(state.notes) &&
    typeof state.notes === 'object' &&
    Object.values(state.notes ?? {}).every((note) => typeof note === 'string') &&
    Array.isArray(state.discussionPosts) &&
    state.discussionPosts.every(isDiscussionPost)
  );
}

export function parseStoredState(raw: string | null): AppStateV4 {
  if (!raw) return createDefaultState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppStateV4(parsed) ? parsed : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

export function migrateV3State(raw: string | null): AppStateV4 {
  const fallback = createDefaultState();
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isAppStateV3(parsed)) return fallback;

    const answers = Object.fromEntries(
      Object.entries(parsed.answers).filter(([id]) => !REPLACED_QUESTION_IDS.has(id)),
    );
    const notes = Object.fromEntries(
      Object.entries(parsed.notes).filter(([id]) => !REPLACED_QUESTION_IDS.has(id)),
    );
    return {
      version: 4,
      answers,
      difficultQuestionIds: parsed.difficultQuestionIds.filter(
        (id) => !REPLACED_QUESTION_IDS.has(id),
      ),
      attempts: parsed.attempts.filter((attempt) =>
        attempt.questionIds.every((id) => !REPLACED_QUESTION_IDS.has(id)),
      ),
      notes,
      discussionPosts: parsed.discussionPosts.filter(
        (post) => !REPLACED_QUESTION_IDS.has(post.questionId),
      ),
    };
  } catch {
    return fallback;
  }
}

interface LegacyState {
  version: 2;
  answers?: Record<string, AnswerRecord>;
  difficultQuestionIds?: number[];
}

export function migrateLegacyState(raw: string | null): AppStateV4 {
  const fallback = createDefaultState();
  if (!raw) return fallback;
  try {
    const legacy = JSON.parse(raw) as LegacyState;
    if (legacy.version !== 2) return fallback;

    const legacyQuestionIds = [
      'law-114-01',
      'env-114-01',
      'construction-114-01',
      'structure-114-01',
      'law-113-01',
      'env-113-01',
      'construction-113-01',
      'structure-113-01',
      'law-112-01',
      'env-112-01',
      'construction-112-01',
      'structure-112-01',
      'law-111-01',
      'env-111-01',
      'construction-110-01',
      'structure-110-01',
      'law-108-01',
      'env-106-01',
      'construction-104-01',
      'structure-102-01',
    ] as const;

    for (const [legacyId, answer] of Object.entries(legacy.answers ?? {})) {
      const questionId = legacyQuestionIds[Number(legacyId) - 1];
      if (
        questionId &&
        !REPLACED_QUESTION_IDS.has(questionId) &&
        isAnswerRecord(answer)
      ) {
        fallback.answers[questionId] = answer;
      }
    }
    fallback.difficultQuestionIds = (legacy.difficultQuestionIds ?? [])
      .map((legacyId) => legacyQuestionIds[legacyId - 1])
      .filter(
        (questionId): questionId is NonNullable<typeof questionId> =>
          Boolean(questionId) && !REPLACED_QUESTION_IDS.has(questionId),
      );
    return fallback;
  } catch {
    return fallback;
  }
}

export function isSubjectId(value: unknown): value is SubjectId {
  return typeof value === 'string' && subjects.some((subject) => subject.id === value);
}

export function parseYear(value: unknown): number | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  const year = Number(normalized);
  return Number.isInteger(year) && year >= 102 && year <= 114 ? year : null;
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function getAcceptedAnswerIndexes(question: Question) {
  return question.answerKey.kind === 'all-credit'
    ? question.options.map((_, index) => index)
    : question.answerKey.options;
}

export function isQuestionCorrect(question: Question, selected: number | undefined) {
  if (question.answerKey.kind === 'all-credit') return true;
  return selected !== undefined && question.answerKey.options.includes(selected);
}

export function createAttempt({
  mode,
  source,
  answers,
  startedAt,
  elapsedSeconds,
}: {
  mode: QuizAttempt['mode'];
  source: readonly Question[];
  answers: Record<string, number>;
  startedAt: string;
  elapsedSeconds: number;
}): QuizAttempt {
  const correctCount = source.filter((question) =>
    isQuestionCorrect(question, answers[question.id]),
  ).length;
  const unansweredCount = source.filter(
    (question) =>
      answers[question.id] === undefined && question.answerKey.kind !== 'all-credit',
  ).length;
  const first = source[0];
  const sameSubject = source.every((question) => question.subject === first?.subject);
  const sameYear = source.every((question) => question.year === first?.year);
  const submittedAt = new Date().toISOString();
  return {
    id: `attempt-${submittedAt}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    subject: sameSubject && first ? first.subject : 'mixed',
    year: sameYear && first ? first.year : null,
    questionIds: source.map((question) => question.id),
    answers: { ...answers },
    startedAt,
    submittedAt,
    elapsedSeconds,
    correctCount,
    wrongCount: source.length - correctCount - unansweredCount,
    unansweredCount,
  };
}

export function getAnalysis(source: readonly { primaryCategory: string }[]) {
  const counts = new Map<string, number>();
  source.forEach((question) => {
    counts.set(question.primaryCategory, (counts.get(question.primaryCategory) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percentage: source.length ? (count / source.length) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}
