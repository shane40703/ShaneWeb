import {
  paperProgressScope,
  parseStoredQuizProgress,
  quizProgressReducer,
  type QuizProgressByQuestion,
} from './mock-exam-progress';
import { calculateScore, createAttempt, getSubjectScoreConfig } from '@/lib/study';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { practiceMockExamPage } from './practice-pages';

export const MOCK_EXAM_PATH = practiceMockExamPage.href;

/** One past paper as the setup lists it; built at build time, so no bank ships with it. */
export interface MockExamPaper {
  subject: SubjectId;
  year: number;
  /** Multiple-choice questions, the only ones answered and scored. */
  questionCount: number;
  writtenCount: number;
  /** Opens the paper's essay questions in 歷屆試題（新版）. */
  firstWrittenId: string | null;
}

/** What the hub needs of a paper to list its draft. */
export type MockExamPaperRef = Pick<MockExamPaper, 'subject' | 'year' | 'questionCount'>;

type PaperSource = Pick<
  Question,
  'id' | 'format' | 'subject' | 'year' | 'questionNumber'
>;

/** Every paper with multiple-choice questions, in catalog order and newest year first. */
export function buildMockExamPapers(questions: readonly PaperSource[]): MockExamPaper[] {
  const papers = new Map<string, MockExamPaper & { firstWrittenNumber: number }>();
  questions.forEach((question) => {
    const key = `${question.subject}:${question.year}`;
    const paper = papers.get(key) ?? {
      subject: question.subject,
      year: question.year,
      questionCount: 0,
      writtenCount: 0,
      firstWrittenId: null,
      firstWrittenNumber: Infinity,
    };
    if (question.format === 'written') {
      paper.writtenCount += 1;
      if (question.questionNumber < paper.firstWrittenNumber) {
        paper.firstWrittenNumber = question.questionNumber;
        paper.firstWrittenId = question.id;
      }
    } else {
      paper.questionCount += 1;
    }
    papers.set(key, paper);
  });
  const order = subjects.map((subject) => subject.id as SubjectId);
  return [...papers.values()]
    .filter((paper) => paper.questionCount > 0)
    .sort(
      (left, right) =>
        order.indexOf(left.subject) - order.indexOf(right.subject) ||
        right.year - left.year,
    )
    .map(({ subject, year, questionCount, writtenCount, firstWrittenId }) => ({
      subject,
      year,
      questionCount,
      writtenCount,
      firstWrittenId,
    }));
}

export function findMockExamPaper(
  papers: readonly MockExamPaper[],
  subject: SubjectId,
  year: number,
) {
  return papers.find((paper) => paper.subject === subject && paper.year === year);
}

interface MockExamLocation {
  subject: SubjectId;
  year?: number;
  /** 1-based position in the paper. */
  q?: number;
  result?: string;
}

export function mockExamHref({ subject, year, q, result }: MockExamLocation) {
  const query = new URLSearchParams({ subject });
  if (year !== undefined) query.set('year', String(year));
  if (q !== undefined) query.set('q', String(q));
  if (result !== undefined) query.set('result', result);
  return `${MOCK_EXAM_PATH}?${query.toString()}`;
}

/** The draft key the original 歷屆試題 used, so a paper keeps one draft whichever page opens it. */
export function mockExamScope(subject: SubjectId, year: number) {
  return paperProgressScope(subject, year);
}

/** The paper's multiple-choice questions in their original order. */
export function getMockExamQuestions(
  questions: readonly Question[],
  subject: SubjectId,
  year: number,
) {
  return questions
    .filter(
      (question) =>
        question.subject === subject &&
        question.year === year &&
        question.format !== 'written' &&
        question.answerKey.kind !== 'written',
    )
    .sort((left, right) => left.questionNumber - right.questionNumber);
}

/** The id a paper question has; papers are numbered 1..n without gaps. */
export function mockExamQuestionId(subject: SubjectId, year: number, number: number) {
  return `${subject}-${year}-${String(number).padStart(2, '0')}`;
}

export function hasMockExamDraft(progress: QuizProgressByQuestion) {
  return Object.keys(progress).length > 0;
}

/**
 * A draft someone has worked on: an answer or a struck-out option. The original
 * 歷屆試題 opened a draft just by showing a question, so merely reading a paper there
 * does not make it a paper in progress.
 */
export function isMockExamStarted(progress: QuizProgressByQuestion) {
  return Object.values(progress).some(
    (item) => item?.selected !== undefined || Boolean(item?.eliminatedOptions?.length),
  );
}

export interface MockExamDraftSummary {
  answered: number;
  total: number;
  /** 0-based: the first question without an answer, or the last one when all are answered. */
  resumeIndex: number;
  elapsedSeconds: number;
}

export function summarizeMockExamDraft(
  progress: QuizProgressByQuestion,
  questionIds: readonly string[],
): MockExamDraftSummary {
  const answered = questionIds.filter(
    (id) => progress[id]?.selected !== undefined,
  ).length;
  const firstOpen = questionIds.findIndex((id) => progress[id]?.selected === undefined);
  return {
    answered,
    total: questionIds.length,
    resumeIndex: firstOpen < 0 ? Math.max(0, questionIds.length - 1) : firstOpen,
    elapsedSeconds: questionIds.reduce(
      (total, id) => total + Math.max(0, progress[id]?.elapsedSeconds ?? 0),
      0,
    ),
  };
}

export interface MockExamDraft<
  Paper extends MockExamPaperRef = MockExamPaper,
> extends MockExamDraftSummary {
  paper: Paper;
  /** When the draft last changed, for listing recent drafts first. */
  lastActivity: string;
}

/** Saved drafts of known papers, most recently active first, read straight from storage. */
export function listMockExamDrafts<Paper extends MockExamPaperRef>(
  raw: string | null,
  papers: readonly Paper[],
): MockExamDraft<Paper>[] {
  const scopes = parseStoredQuizProgress(raw);
  return papers
    .flatMap((paper) => {
      const progress = scopes[mockExamScope(paper.subject, paper.year)];
      if (!progress || !hasMockExamDraft(progress)) return [];
      const ids = Array.from({ length: paper.questionCount }, (_, index) =>
        mockExamQuestionId(paper.subject, paper.year, index + 1),
      );
      // Entries of questions the paper no longer has do not make it a draft.
      const own = Object.fromEntries(
        ids.flatMap((id) => (progress[id] ? [[id, progress[id]]] : [])),
      );
      if (!isMockExamStarted(own)) return [];
      const lastActivity = ids.reduce((latest, id) => {
        const item = progress[id];
        const changedAt = item?.updatedAt ?? item?.startedAt ?? '';
        return changedAt > latest ? changedAt : latest;
      }, '');
      return [{ paper, lastActivity, ...summarizeMockExamDraft(progress, ids) }];
    })
    .sort((left, right) => right.lastActivity.localeCompare(left.lastActivity));
}

/** A new draft: the first question counts as opened, which is what makes the paper resumable. */
export function startMockExamDraft(
  firstQuestionId: string,
  startedAt = new Date().toISOString(),
) {
  return quizProgressReducer(
    {},
    { type: 'visit-question', questionId: firstQuestionId, startedAt },
  );
}

/** Adds counted seconds to a question, opening it first when needed. */
export function addMockExamTime(
  progress: QuizProgressByQuestion,
  questionId: string,
  seconds: number,
  startedAt = new Date().toISOString(),
): QuizProgressByQuestion {
  if (seconds <= 0) return progress;
  const current = progress[questionId] ?? { elapsedSeconds: 0, startedAt };
  return {
    ...progress,
    [questionId]: {
      ...current,
      elapsedSeconds: current.elapsedSeconds + seconds,
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Stamps the question just changed, so the hub lists the paper worked on last first. */
export function touchMockExamQuestion(
  progress: QuizProgressByQuestion,
  questionId: string,
  updatedAt = new Date().toISOString(),
): QuizProgressByQuestion {
  const current = progress[questionId];
  return current ? { ...progress, [questionId]: { ...current, updatedAt } } : progress;
}

/** The same record the original 歷屆試題 saved: answers, time and the official scoring rules. */
export function createMockExamAttempt(
  questions: readonly Question[],
  progress: QuizProgressByQuestion,
) {
  const answers = Object.fromEntries(
    questions.flatMap((question) => {
      const selected = progress[question.id]?.selected;
      return selected === undefined ? [] : [[question.id, selected] as const];
    }),
  );
  const visited = questions.flatMap((question) => {
    const item = progress[question.id];
    return item ? [item] : [];
  });
  const now = new Date().toISOString();
  return createAttempt({
    mode: 'paper',
    source: questions,
    answers,
    startedAt: visited.reduce(
      (earliest, item) => (item.startedAt < earliest ? item.startedAt : earliest),
      now,
    ),
    elapsedSeconds: visited.reduce((total, item) => total + item.elapsedSeconds, 0),
  });
}

/**
 * What a submitted paper left blank. 一律給分 questions score even when blank, as on
 * the real exam, so the record counts them as answered correctly.
 */
export function countMockExamBlanks(
  attempt: Pick<QuizAttempt, 'questionIds' | 'answers' | 'unansweredCount'>,
) {
  const blank = attempt.questionIds.filter(
    (id) => attempt.answers[id] === undefined,
  ).length;
  return { blank, free: Math.max(0, blank - attempt.unansweredCount) };
}

/** The 交卷 confirmation, or null when every question has an answer. */
export function mockExamSubmitWarning(
  questions: readonly Pick<Question, 'id' | 'answerKey'>[],
  progress: QuizProgressByQuestion,
) {
  const blank = questions.filter(
    (question) => progress[question.id]?.selected === undefined,
  );
  if (!blank.length) return null;
  const free = blank.filter(
    (question) => question.answerKey.kind === 'all-credit',
  ).length;
  const rule = !free
    ? '未作答的題目不給分'
    : free === blank.length
      ? '這些題目一律給分，仍會計分'
      : `其中 ${free} 題一律給分仍會計分，其餘不給分`;
  return `還有 ${blank.length} 題未作答，${rule}。確定要交卷嗎？`;
}

export function getMockExamScore(
  attempt: Pick<QuizAttempt, 'correctCount'>,
  subject: SubjectId,
) {
  return {
    score: calculateScore(attempt.correctCount, subject),
    maximumScore: getSubjectScoreConfig(subject).maximumScore,
  };
}

export function formatMockExamScore(score: number) {
  return score.toFixed(2);
}

/** Saved results of one paper, newest first. */
export function getMockExamAttempts(
  attempts: readonly QuizAttempt[],
  subject: SubjectId,
  year: number,
) {
  return attempts
    .filter(
      (attempt) =>
        attempt.mode === 'paper' && attempt.subject === subject && attempt.year === year,
    )
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}
