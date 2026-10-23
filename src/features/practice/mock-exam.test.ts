import { describe, expect, it } from 'vitest';
import {
  QUIZ_PROGRESS_STORAGE_KEY,
  createQuizProgressScope,
  writeQuizProgress,
} from '@/features/quiz/quiz-state';
import { readStoredValue } from '@/lib/storage';
import type { Question, SubjectId } from '@/lib/types';
import {
  addMockExamTime,
  buildMockExamPapers,
  countMockExamBlanks,
  createMockExamAttempt,
  getMockExamAttempts,
  getMockExamQuestions,
  getMockExamScore,
  listMockExamDrafts,
  mockExamHref,
  mockExamQuestionId,
  mockExamScope,
  mockExamSubmitWarning,
  startMockExamDraft,
  summarizeMockExamDraft,
  touchMockExamQuestion,
} from './mock-exam';

function question(
  subject: SubjectId,
  year: number,
  number: number,
  { written = false, allCredit = false } = {},
): Question {
  return {
    id: written
      ? `${subject}-${year}-written-${String(number).padStart(2, '0')}`
      : mockExamQuestionId(subject, year, number),
    ...(written ? { format: 'written' as const } : {}),
    subject,
    year,
    questionNumber: number,
    topic: '建築法',
    primaryCategory: '建築法',
    tags: [],
    text: `第 ${number} 題`,
    content: [{ kind: 'text', text: `第 ${number} 題` }],
    options: written ? [] : ['甲', '乙', '丙', '丁'],
    answerKey: written
      ? { kind: 'written' }
      : allCredit
        ? { kind: 'all-credit' }
        : { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

describe('mock exam papers', () => {
  it('lists every paper with multiple-choice questions, newest first within each subject', () => {
    const papers = buildMockExamPapers([
      question('env', 113, 1),
      question('env', 113, 2, { written: true }),
      question('env', 113, 1, { written: true }),
      question('law', 113, 1),
      question('law', 114, 2),
      question('law', 114, 1),
      // Essays alone are not a paper the mock exam can score.
      question('structure', 114, 1, { written: true }),
    ]);

    expect(papers).toEqual([
      {
        subject: 'law',
        year: 114,
        questionCount: 2,
        writtenCount: 0,
        firstWrittenId: null,
      },
      {
        subject: 'law',
        year: 113,
        questionCount: 1,
        writtenCount: 0,
        firstWrittenId: null,
      },
      {
        subject: 'env',
        year: 113,
        questionCount: 1,
        writtenCount: 2,
        firstWrittenId: 'env-113-written-01',
      },
    ]);
  });

  it('answers only the multiple-choice questions, in their original order', () => {
    const questions = [
      question('law', 114, 3),
      question('law', 114, 1, { written: true }),
      question('law', 114, 1),
      question('law', 113, 2),
      question('law', 114, 2),
    ];

    expect(getMockExamQuestions(questions, 'law', 114).map((item) => item.id)).toEqual([
      'law-114-01',
      'law-114-02',
      'law-114-03',
    ]);
  });

  it('builds links that keep the paper and the place in it', () => {
    expect(mockExamHref({ subject: 'law' })).toBe('/practice/mock-exam?subject=law');
    expect(mockExamHref({ subject: 'env', year: 113, q: 12 })).toBe(
      '/practice/mock-exam?subject=env&year=113&q=12',
    );
    expect(mockExamHref({ subject: 'env', year: 113, result: 'attempt-1' })).toBe(
      '/practice/mock-exam?subject=env&year=113&result=attempt-1',
    );
  });

  it('shares the original 歷屆試題 draft of the same paper', () => {
    expect(mockExamScope('law', 114)).toBe(
      createQuizProgressScope({ mode: 'paper', subject: 'law', year: 114 }),
    );
  });
});

describe('mock exam drafts', () => {
  const ids = [1, 2, 3, 4].map((number) => mockExamQuestionId('law', 114, number));

  it('resumes at the first unanswered question, or the last when all are answered', () => {
    const started = startMockExamDraft(ids[0], '2026-10-01T00:00:00.000Z');
    expect(summarizeMockExamDraft(started, ids)).toEqual({
      answered: 0,
      total: 4,
      resumeIndex: 0,
      elapsedSeconds: 0,
    });

    const answered = {
      [ids[0]]: { selected: 1, elapsedSeconds: 30, startedAt: 'a' },
      [ids[1]]: { elapsedSeconds: 5, startedAt: 'b' },
      [ids[2]]: { selected: 0, elapsedSeconds: 10, startedAt: 'c' },
    };
    expect(summarizeMockExamDraft(answered, ids)).toMatchObject({
      answered: 2,
      resumeIndex: 1,
      elapsedSeconds: 45,
    });

    const finished = Object.fromEntries(
      ids.map((id) => [id, { selected: 0, elapsedSeconds: 1, startedAt: 'a' }]),
    );
    expect(summarizeMockExamDraft(finished, ids).resumeIndex).toBe(3);
  });

  it('adds counted seconds to a question, opening it when needed', () => {
    const started = startMockExamDraft(ids[0], 'start');
    const timed = addMockExamTime(started, ids[0], 4, 'later');
    expect(timed[ids[0]]).toMatchObject({ elapsedSeconds: 4, startedAt: 'start' });
    expect(addMockExamTime(timed, ids[1], 2, 'later')[ids[1]]).toMatchObject({
      elapsedSeconds: 2,
      startedAt: 'later',
    });
    expect(addMockExamTime(timed, ids[1], 0)).toBe(timed);
  });

  it('lists saved drafts of known papers, most recently active first', () => {
    window.localStorage.clear();
    writeQuizProgress(mockExamScope('law', 114), {
      'law-114-01': {
        selected: 0,
        elapsedSeconds: 3,
        startedAt: '2026-10-01T00:00:00.000Z',
      },
      'law-114-02': { elapsedSeconds: 1, startedAt: '2026-10-03T00:00:00.000Z' },
    });
    writeQuizProgress(mockExamScope('env', 113), {
      'env-113-01': {
        selected: 1,
        elapsedSeconds: 3,
        startedAt: '2026-10-02T00:00:00.000Z',
      },
    });
    // A paper the bank no longer has, and a random set, are not paper drafts.
    writeQuizProgress(mockExamScope('law', 99), {
      'law-099-01': { elapsedSeconds: 3, startedAt: '2026-10-09T00:00:00.000Z' },
    });
    writeQuizProgress('random:set:law-114-01', {
      'law-114-01': { elapsedSeconds: 3, startedAt: '2026-10-09T00:00:00.000Z' },
    });
    // Only shown, never answered: the original page opened drafts like this.
    writeQuizProgress(mockExamScope('env', 114), {
      'env-114-01': { elapsedSeconds: 30, startedAt: '2026-10-09T00:00:00.000Z' },
    });
    const papers = [
      { subject: 'law' as const, year: 114, questionCount: 80 },
      { subject: 'env' as const, year: 113, questionCount: 40 },
      { subject: 'env' as const, year: 114, questionCount: 40 },
    ];

    const drafts = listMockExamDrafts(readStoredValue(QUIZ_PROGRESS_STORAGE_KEY), papers);

    expect(
      drafts.map(({ paper, answered, total, resumeIndex }) => [
        `${paper.subject}-${paper.year}`,
        answered,
        total,
        resumeIndex,
      ]),
    ).toEqual([
      ['law-114', 1, 80, 1],
      ['env-113', 1, 40, 1],
    ]);
    expect(listMockExamDrafts(null, papers)).toEqual([]);
  });
});

describe('mock exam draft order', () => {
  it('lists the paper changed last first, not the one opened last', () => {
    window.localStorage.clear();
    // law 114 was opened first but answered again just now.
    writeQuizProgress(mockExamScope('law', 114), {
      'law-114-01': {
        selected: 0,
        elapsedSeconds: 3,
        startedAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      },
    });
    writeQuizProgress(mockExamScope('law', 113), {
      'law-113-01': {
        selected: 0,
        elapsedSeconds: 3,
        startedAt: '2026-10-04T00:00:00.000Z',
      },
    });
    const papers = [
      { subject: 'law' as const, year: 114, questionCount: 80 },
      { subject: 'law' as const, year: 113, questionCount: 80 },
    ];

    expect(
      listMockExamDrafts(readStoredValue(QUIZ_PROGRESS_STORAGE_KEY), papers).map(
        ({ paper }) => paper.year,
      ),
    ).toEqual([114, 113]);
  });

  it('stamps changed questions and counted time', () => {
    const started = startMockExamDraft('law-114-01', 'start');
    expect(touchMockExamQuestion(started, 'law-114-01', 'now')['law-114-01']).toEqual({
      elapsedSeconds: 0,
      startedAt: 'start',
      updatedAt: 'now',
    });
    expect(touchMockExamQuestion(started, 'law-114-02', 'now')).toBe(started);
    expect(addMockExamTime(started, 'law-114-01', 2)['law-114-01']?.updatedAt).toEqual(
      expect.any(String),
    );
  });
});

describe('mock exam results', () => {
  const questions = [
    question('law', 114, 1),
    question('law', 114, 2),
    question('law', 114, 3),
    question('law', 114, 4, { allCredit: true }),
  ];

  it('records the paper like the original 歷屆試題, 一律給分 included', () => {
    const attempt = createMockExamAttempt(questions, {
      'law-114-01': {
        selected: 0,
        elapsedSeconds: 20,
        startedAt: '2026-10-02T00:00:00.000Z',
      },
      'law-114-02': {
        selected: 2,
        elapsedSeconds: 15,
        startedAt: '2026-10-01T00:00:00.000Z',
      },
      'law-114-03': { elapsedSeconds: 5, startedAt: '2026-10-03T00:00:00.000Z' },
    });

    expect(attempt).toMatchObject({
      mode: 'paper',
      subject: 'law',
      year: 114,
      questionIds: ['law-114-01', 'law-114-02', 'law-114-03', 'law-114-04'],
      answers: { 'law-114-01': 0, 'law-114-02': 2 },
      startedAt: '2026-10-01T00:00:00.000Z',
      elapsedSeconds: 40,
      correctCount: 2,
      wrongCount: 1,
      unansweredCount: 1,
    });
    expect(getMockExamScore(attempt, 'law')).toEqual({ score: 2.5, maximumScore: 100 });
    expect(getMockExamScore({ correctCount: 40 }, 'env')).toEqual({
      score: 60,
      maximumScore: 60,
    });
  });

  it('finds the saved results of one paper, newest first', () => {
    const base = createMockExamAttempt(questions, {});
    const attempts = [
      { ...base, id: 'old', submittedAt: '2026-10-01T00:00:00.000Z' },
      { ...base, id: 'other-year', year: 113, submittedAt: '2026-10-05T00:00:00.000Z' },
      { ...base, id: 'new', submittedAt: '2026-10-03T00:00:00.000Z' },
    ];

    expect(getMockExamAttempts(attempts, 'law', 114).map((item) => item.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('says which blank questions still score before 交卷', () => {
    const progress = { 'law-114-01': { selected: 0, elapsedSeconds: 1, startedAt: 'a' } };
    expect(mockExamSubmitWarning(questions.slice(0, 3), progress)).toBe(
      '還有 2 題未作答，未作答的題目不給分。確定要交卷嗎？',
    );
    expect(mockExamSubmitWarning(questions, progress)).toBe(
      '還有 3 題未作答，其中 1 題一律給分仍會計分，其餘不給分。確定要交卷嗎？',
    );
    expect(mockExamSubmitWarning([questions[3]], {})).toBe(
      '還有 1 題未作答，這些題目一律給分，仍會計分。確定要交卷嗎？',
    );
    expect(mockExamSubmitWarning(questions.slice(0, 1), progress)).toBeNull();
  });

  it('counts the blanks of a record, telling 一律給分 apart', () => {
    const attempt = createMockExamAttempt(questions, {
      'law-114-01': { selected: 0, elapsedSeconds: 1, startedAt: 'a' },
    });
    expect(countMockExamBlanks(attempt)).toEqual({ blank: 3, free: 1 });
  });
});
