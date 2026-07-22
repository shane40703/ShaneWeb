import { questions, subjects } from '@/data/questions';
import type {
  AnswerRecord,
  AppStateV3,
  DiscussionPost,
  PracticeFilters,
  Question,
  QuizAttempt,
  SubjectId,
} from '@/lib/types';

export const STORAGE_KEY = 'shaneweb:v3';
export const LEGACY_STORAGE_KEY = 'shaneweb:v2';

const starterDiscussions: DiscussionPost[] = [
  {
    id: 'starter-law-114-01',
    questionId: 'law-114-01',
    type: 'explanation',
    content: '判讀這類題目時，可以先抓出「居室」與「採光有效面積」兩個關鍵詞，再對照比例規定。',
    createdAt: '2026-07-18T09:20:00.000Z',
    likes: 8,
    replies: [
      {
        id: 'starter-reply-1',
        content: '把八分之一和通風面積的規定分開記，會比較不容易混淆。',
        createdAt: '2026-07-19T03:10:00.000Z',
      },
    ],
    reported: false,
  },
];

export function createDefaultState(): AppStateV3 {
  return {
    version: 3,
    answers: {},
    difficultQuestionIds: [],
    attempts: [],
    notes: {},
    discussionPosts: starterDiscussions.map((post) => ({
      ...post,
      replies: post.replies.map((reply) => ({ ...reply })),
    })),
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

export function parseStoredState(raw: string | null): AppStateV3 {
  if (!raw) return createDefaultState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppStateV3(parsed) ? parsed : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

interface LegacyState {
  version: 2;
  answers?: Record<string, AnswerRecord>;
  difficultQuestionIds?: number[];
}

export function migrateLegacyState(raw: string | null): AppStateV3 {
  const fallback = createDefaultState();
  if (!raw) return fallback;
  try {
    const legacy = JSON.parse(raw) as LegacyState;
    if (legacy.version !== 2) return fallback;

    for (const [legacyId, answer] of Object.entries(legacy.answers ?? {})) {
      const question = questions[Number(legacyId) - 1];
      if (question && isAnswerRecord(answer)) fallback.answers[question.id] = answer;
    }
    fallback.difficultQuestionIds = (legacy.difficultQuestionIds ?? [])
      .map((legacyId) => questions[legacyId - 1]?.id)
      .filter((questionId): questionId is string => Boolean(questionId));
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

export function getPaperQuestions(subject: SubjectId, year: number) {
  return questions
    .filter((question) => question.subject === subject && question.year === year)
    .sort((left, right) => left.questionNumber - right.questionNumber);
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function buildQuiz(
  filters: PracticeFilters,
  state: Pick<AppStateV3, 'answers' | 'difficultQuestionIds'>,
  random: () => number = Math.random,
  source: readonly Question[] = questions,
) {
  const minimumYear = Math.min(filters.fromYear, filters.toYear);
  const maximumYear = Math.max(filters.fromYear, filters.toYear);
  const pool = source.filter(
    (question) =>
      (filters.subject === 'all' || question.subject === filters.subject) &&
      question.year >= minimumYear &&
      question.year <= maximumYear &&
      (!filters.onlyUnanswered || !state.answers[question.id]) &&
      (!filters.onlyDifficult || state.difficultQuestionIds.includes(question.id)),
  );
  const count = Math.max(1, Math.min(filters.count, pool.length));
  return shuffled(pool, random).slice(0, count);
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
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
  const answeredQuestions = source.filter((question) => answers[question.id] !== undefined);
  const correctCount = answeredQuestions.filter(
    (question) => answers[question.id] === question.answer,
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
    wrongCount: answeredQuestions.length - correctCount,
    unansweredCount: source.length - answeredQuestions.length,
  };
}

export function getAnalysis(source: readonly Question[]) {
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
