import { subjects } from '@/question-bank/catalog';
import type {
  AnswerRecord,
  AppState,
  DiscussionPost,
  Question,
  QuizAttempt,
  SubjectId,
} from '@/lib/types';

export const STORAGE_KEY = 'shaneweb:state';

export function createDefaultState(): AppState {
  return {
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

export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppState>;
  return (
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

export function parseStoredState(raw: string | null): AppState {
  if (!raw) return createDefaultState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppState(parsed) ? parsed : createDefaultState();
  } catch {
    return createDefaultState();
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

export function calculateScore(
  correctCount: number,
  totalQuestions: number,
  maximumScore = 60,
) {
  return totalQuestions ? (correctCount / totalQuestions) * maximumScore : 0;
}

export function pickRandomItems<T>(
  source: readonly T[],
  count: number,
  random: () => number = Math.random,
) {
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, Math.max(0, Math.min(Math.floor(count), shuffled.length)));
}

export function getAcceptedAnswerIndexes(question: Question) {
  return question.answerKey.kind === 'all-credit'
    ? question.options.map((_, index) => index)
    : question.answerKey.options;
}

export function isQuestionCorrect(
  question: Pick<Question, 'answerKey'>,
  selected: number | undefined,
) {
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

export function getLawAnalysis(
  source: readonly { relatedLaws?: readonly string[] }[],
) {
  const counts = new Map<string, number>();
  let totalReferences = 0;

  source.forEach((question) => {
    question.relatedLaws?.forEach((law) => {
      counts.set(law, (counts.get(law) ?? 0) + 1);
      totalReferences += 1;
    });
  });

  return [...counts.entries()]
    .map(([law, count]) => ({
      law,
      count,
      percentage: totalReferences ? (count / totalReferences) * 100 : 0,
    }))
    .sort((left, right) => right.count - left.count || left.law.localeCompare(right.law));
}
