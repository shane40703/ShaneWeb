import { questions, subjects, years } from '@/data/questions';
import type {
  AnswerRecord,
  AppStateV2,
  PaperFilters,
  PaperStatus,
  PracticeFilters,
  Question,
  SubjectId,
} from '@/lib/types';

export const STORAGE_KEY = 'shaneweb:v2';

export const defaultPreferences: AppStateV2['preferences'] = {
  theme: 'light',
  fontScale: 'normal',
  sidebarCollapsed: false,
  instantFeedback: true,
};

export function createDefaultState(): AppStateV2 {
  return {
    version: 2,
    answers: {},
    difficultQuestionIds: [],
    history: [],
    preferences: { ...defaultPreferences },
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

export function isAppStateV2(value: unknown): value is AppStateV2 {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<AppStateV2>;
  const preferences = state.preferences;
  if (
    state.version !== 2 ||
    !state.answers ||
    typeof state.answers !== 'object' ||
    !Array.isArray(state.difficultQuestionIds) ||
    !Array.isArray(state.history) ||
    !preferences ||
    !['light', 'dark'].includes(preferences.theme) ||
    !['normal', 'large'].includes(preferences.fontScale) ||
    typeof preferences.sidebarCollapsed !== 'boolean' ||
    typeof preferences.instantFeedback !== 'boolean'
  ) {
    return false;
  }

  return (
    Object.values(state.answers).every(isAnswerRecord) &&
    state.difficultQuestionIds.every(Number.isInteger) &&
    state.history.every(
      (entry) =>
        isAnswerRecord(entry) &&
        typeof entry.id === 'string' &&
        Number.isInteger(entry.questionId),
    )
  );
}

export function parseStoredState(raw: string | null): AppStateV2 {
  if (!raw) return createDefaultState();
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppStateV2(parsed) ? parsed : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

export function isSubjectId(value: string | null): value is SubjectId {
  return subjects.some((subject) => subject.id === value);
}

export function isPaperStatus(value: string | null): value is PaperStatus {
  return ['all', 'unanswered', 'answered', 'wrong'].includes(value ?? '');
}

export function parsePaperFilters(params: URLSearchParams): PaperFilters {
  const yearValue = Number(params.get('year'));
  const year = years.includes(yearValue) ? yearValue : 'all';
  const subjectValue = params.get('subject');
  const statusValue = params.get('status');
  return {
    year,
    subject: isSubjectId(subjectValue) ? subjectValue : 'all',
    status: isPaperStatus(statusValue) ? statusValue : 'all',
  };
}

export function filterPapers(
  source: readonly Question[],
  answers: AppStateV2['answers'],
  filters: PaperFilters,
) {
  return source.filter((question) => {
    const answer = answers[question.id];
    const matchesStatus =
      filters.status === 'all' ||
      (filters.status === 'unanswered' && !answer) ||
      (filters.status === 'answered' && Boolean(answer)) ||
      (filters.status === 'wrong' && Boolean(answer) && !answer.correct);
    return (
      (filters.year === 'all' || question.year === filters.year) &&
      (filters.subject === 'all' || question.subject === filters.subject) &&
      matchesStatus
    );
  });
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
  state: Pick<AppStateV2, 'answers' | 'difficultQuestionIds'>,
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

export function getStudyStats(state: AppStateV2) {
  const answerValues = Object.values(state.answers);
  const correct = answerValues.filter((answer) => answer.correct).length;
  return {
    total: questions.length,
    answered: answerValues.length,
    difficult: state.difficultQuestionIds.length,
    completion: Math.round((answerValues.length / questions.length) * 100),
    accuracy: answerValues.length ? Math.round((correct / answerValues.length) * 100) : 0,
  };
}
