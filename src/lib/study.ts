import { subjects, years } from '@/question-bank/catalog';
import { questionPath } from '@/lib/question-path';
import { analysisCategoryCatalog } from '@/question-bank/schema';
import type {
  AnswerRecord,
  AppState,
  ContentReport,
  DiscussionPost,
  ImageAttachment,
  Question,
  QuizAttempt,
  QuizQuestion,
  SubjectId,
} from '@/lib/types';

export const STORAGE_KEY = 'shaneweb:state';

export function createDefaultState(): AppState {
  return {
    answers: {},
    difficultQuestionIds: [],
    attempts: [],
    notes: {},
    noteImages: {},
    discussionPosts: [],
    likedDiscussionPostIds: [],
    readingPreferences: {
      questionFontSize: 18,
      optionFontSize: 18,
    },
    contentReports: [],
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
    (attempt.subject === 'mixed' || isSubjectId(attempt.subject)) &&
    (attempt.year === null || Number.isInteger(attempt.year)) &&
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
    (post.images === undefined ||
      (Array.isArray(post.images) && post.images.every(isImageAttachment))) &&
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

function isImageAttachment(value: unknown): value is ImageAttachment {
  if (!value || typeof value !== 'object') return false;
  const image = value as Partial<ImageAttachment>;
  return (
    typeof image.id === 'string' &&
    typeof image.name === 'string' &&
    typeof image.type === 'string' &&
    image.type.startsWith('image/') &&
    typeof image.dataUrl === 'string' &&
    image.dataUrl.startsWith('data:image/')
  );
}

function keepValidEntries<T>(
  value: unknown,
  isValid: (entry: unknown) => entry is T,
): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, T] => isValid(entry[1])),
  );
}

function keepValidItems<T>(value: unknown, isValid: (entry: unknown) => entry is T): T[] {
  return Array.isArray(value) ? value.filter(isValid) : [];
}

function isQuestionId(value: unknown): value is string {
  return typeof value === 'string';
}

function isNoteContent(value: unknown): value is string {
  return typeof value === 'string';
}

function isImageAttachmentList(value: unknown): value is ImageAttachment[] {
  return Array.isArray(value) && value.every(isImageAttachment);
}

function isContentReport(value: unknown): value is ContentReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<ContentReport>;
  return (
    typeof report.id === 'string' &&
    typeof report.pageUrl === 'string' &&
    typeof report.questionId === 'string' &&
    ['題目內容', '答案', '圖片', '詳解', '其他'].includes(report.category ?? '') &&
    typeof report.description === 'string' &&
    typeof report.createdAt === 'string'
  );
}

/**
 * Rebuilds the stored state entry by entry so a single corrupt record — an
 * attempt from an older schema, a truncated write — costs the user only that
 * record instead of their entire history.
 */
export function parseStoredState(raw: string | null): AppState {
  if (!raw) return createDefaultState();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createDefaultState();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return createDefaultState();
  }

  const state = parsed as Record<string, unknown>;
  const preferences =
    state.readingPreferences &&
    typeof state.readingPreferences === 'object' &&
    !Array.isArray(state.readingPreferences)
      ? (state.readingPreferences as Record<string, unknown>)
      : {};
  const validFontSize = (value: unknown) =>
    typeof value === 'number' && [14, 16, 18, 20, 22, 24].includes(value)
      ? value
      : 18;
  return {
    answers: keepValidEntries(state.answers, isAnswerRecord),
    difficultQuestionIds: keepValidItems(state.difficultQuestionIds, isQuestionId),
    attempts: keepValidItems(state.attempts, isQuizAttempt).filter(
      (attempt) => attempt.mode === 'paper',
    ),
    notes: keepValidEntries(state.notes, isNoteContent),
    noteImages: keepValidEntries(state.noteImages, isImageAttachmentList),
    discussionPosts: keepValidItems(state.discussionPosts, isDiscussionPost).map(
      (post) => ({ ...post, images: post.images ?? [] }),
    ),
    likedDiscussionPostIds: keepValidItems(state.likedDiscussionPostIds, isQuestionId),
    readingPreferences: {
      questionFontSize: validFontSize(preferences.questionFontSize),
      optionFontSize: validFontSize(preferences.optionFontSize),
    },
    contentReports: keepValidItems(state.contentReports, isContentReport),
  };
}

export function isSubjectId(value: unknown): value is SubjectId {
  return typeof value === 'string' && subjects.some((subject) => subject.id === value);
}

export function parseYear(value: unknown): number | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  const year = Number(normalized);
  return years.includes(year) ? year : null;
}

const taipeiDateTime = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Formats an ISO timestamp as `YYYY/MM/DD HH:mm` in the exam board's timezone. */
export function formatDateTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : taipeiDateTime.format(date);
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function getAttemptScopeKey(
  attempt: Pick<QuizAttempt, 'mode' | 'subject' | 'year' | 'questionIds'>,
) {
  if (attempt.mode === 'paper' && attempt.subject !== 'mixed' && attempt.year !== null) {
    return `paper:${attempt.subject}:${attempt.year}`;
  }

  return `random:${[...attempt.questionIds].sort().join(',')}`;
}

const subjectScoreConfigs: Record<
  SubjectId,
  { maximumScore: number; pointsPerQuestion: number }
> = {
  law: { maximumScore: 100, pointsPerQuestion: 1.25 },
  env: { maximumScore: 60, pointsPerQuestion: 1.5 },
  construction: { maximumScore: 100, pointsPerQuestion: 1.25 },
  structure: { maximumScore: 60, pointsPerQuestion: 1.5 },
};

export function getSubjectScoreConfig(subject: SubjectId) {
  return subjectScoreConfigs[subject];
}

export function calculateScore(correctCount: number, subject: SubjectId) {
  const { maximumScore, pointsPerQuestion } = getSubjectScoreConfig(subject);
  return Math.min(Math.max(0, correctCount) * pointsPerQuestion, maximumScore);
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

export function getAcceptedAnswerIndexes(
  question: Pick<Question, 'options' | 'answerKey'>,
) {
  return question.answerKey.kind === 'all-credit'
    ? question.options.map((_, index) => index)
    : question.answerKey.options;
}

export function formatCorrectAnswer(question: Pick<Question, 'answerKey'>) {
  return question.answerKey.kind === 'all-credit'
    ? '本題一律給分'
    : question.answerKey.options
        .map((index) => String.fromCharCode(65 + index))
        .join('、');
}

export function getQuestionDisplayCategory(
  question: Pick<Question, 'subject' | 'topic' | 'primaryCategory' | 'relatedLaws'>,
) {
  return getQuestionDisplayCategories(question)[0];
}

export function getQuestionDisplayCategories(
  question: Pick<Question, 'subject' | 'topic' | 'primaryCategory' | 'relatedLaws'>,
) {
  return question.relatedLaws?.length
    ? [...new Set(question.relatedLaws)]
    : [
        getAnalysisCategory(
          question.subject,
          question.topic,
          question.primaryCategory,
        ),
      ];
}

export function getAnalysisCategory(subject: SubjectId, topic: string, fallback: string) {
  const categories = analysisCategoryCatalog[subject];
  return (
    Object.entries(categories).find(([, topics]) => topics.includes(topic))?.[0] ??
    fallback
  );
}

export function isQuestionCorrect(
  question: Pick<Question, 'answerKey'>,
  selected: number | undefined,
) {
  if (question.answerKey.kind === 'all-credit') return true;
  return selected !== undefined && question.answerKey.options.includes(selected);
}

type AttemptSource = Pick<Question, 'id' | 'subject' | 'year' | 'answerKey'>;

export function toQuizQuestion(question: Question): QuizQuestion {
  return {
    id: question.id,
    subject: question.subject,
    year: question.year,
    questionNumber: question.questionNumber,
    topic: question.topic,
    primaryCategory: question.primaryCategory,
    ...(question.relatedLaws ? { relatedLaws: question.relatedLaws } : {}),
    text: question.text,
    content: question.content,
    options: question.options,
    answerKey: question.answerKey,
    ...(question.explanation ? { explanation: question.explanation } : {}),
    path: questionPath(question.subject, question.year, question.questionNumber),
  };
}

export function createAttempt({
  mode,
  source,
  answers,
  startedAt,
  elapsedSeconds,
}: {
  mode: QuizAttempt['mode'];
  source: readonly AttemptSource[];
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

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
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
    .sort(
      (left, right) =>
        right.count - left.count || compareText(left.category, right.category),
    );
}

export function getLawAnalysis(
  source: readonly {
    primaryCategory?: string;
    relatedLaws?: readonly string[];
  }[],
) {
  const counts = new Map<string, number>();
  let totalReferences = 0;

  source.forEach((question) => {
    const relatedLaws = question.relatedLaws?.length
      ? question.relatedLaws
      : question.primaryCategory
        ? [question.primaryCategory]
        : [];
    relatedLaws.forEach((law) => {
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
    .sort((left, right) => right.count - left.count || compareText(left.law, right.law));
}
