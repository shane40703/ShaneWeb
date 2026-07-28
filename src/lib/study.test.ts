import { describe, expect, it } from 'vitest';
import { loadAllQuestions, loadQuizQuestions } from '@/server/question-bank.server';
import {
  createAttempt,
  createDefaultState,
  calculateScore,
  formatCorrectAnswer,
  formatDuration,
  getAnalysis,
  getAttemptScopeKey,
  getLawAnalysis,
  getQuestionDisplayCategories,
  getQuestionDisplayCategory,
  getSubjectScoreConfig,
  isQuestionCorrect,
  pickRandomItems,
  parseStoredState,
} from '@/lib/study';

const questions = await loadAllQuestions();

function firstAcceptedAnswer(question: (typeof questions)[number]) {
  return question.answerKey.kind === 'accepted' ? question.answerKey.options[0] : 0;
}

describe('question data', () => {
  it('uses unique canonical ids and valid primary categories', () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    questions.forEach((question) => {
      expect(question.id).toBe(
        `${question.subject}-${question.year}-${String(question.questionNumber).padStart(2, '0')}`,
      );
      expect(question.year).toBeGreaterThanOrEqual(102);
      expect(question.year).toBeLessThanOrEqual(114);
      if (question.answerKey.kind === 'accepted') {
        expect(question.answerKey.options.length).toBeGreaterThan(0);
        question.answerKey.options.forEach((answer) => {
          expect(answer).toBeGreaterThanOrEqual(0);
          expect(answer).toBeLessThan(question.options.length);
        });
      }
      expect(question.primaryCategory.length).toBeGreaterThan(0);
    });
    expect(questions).toHaveLength(3120);
  });

  it('contains every official 113 question in all four subjects', () => {
    const expectedCounts = {
      law: 80,
      env: 40,
      construction: 80,
      structure: 40,
    } as const;

    Object.entries(expectedCounts).forEach(([subject, count]) => {
      const subjectQuestions = questions.filter(
        (question) => question.subject === subject && question.year === 113,
      );
      expect(subjectQuestions).toHaveLength(count);
      expect(subjectQuestions.every((question) => question.source.kind === 'official'))
        .toBe(true);
    });
  });

  it('uses the precise related law as the displayed question category', () => {
    const publicSafetyQuestion = questions.find(
      (question) => question.id === 'law-114-16',
    );
    expect(publicSafetyQuestion).toBeDefined();
    expect(getQuestionDisplayCategory(publicSafetyQuestion!)).toBe(
      '建築物公共安全檢查簽證及申報辦法',
    );
  });

  it('keeps every related law as a display and filtering category', () => {
    const categories = getQuestionDisplayCategories({
      subject: 'law',
      topic: '建築技術規則',
      primaryCategory: '建築技術規則',
      relatedLaws: ['建築法', '建築技術規則'],
    });

    expect(categories).toEqual(['建築法', '建築技術規則']);
  });

  it('uses the author classification for law question 74', () => {
    const question = questions.find((item) => item.id === 'law-114-74');

    expect(question?.primaryCategory).toBe('其他');
    expect(question?.topic).toBe('其他');
    expect(question?.relatedLaws).toEqual(['法律常識']);
    expect(getQuestionDisplayCategory(question!)).toBe('法律常識');
  });

  it('includes available explanations in quiz review data', async () => {
    const quizQuestions = await loadQuizQuestions('law');
    const explainedQuestion = quizQuestions.find(
      (question) => question.id === 'law-111-01',
    );

    expect(explainedQuestion?.explanation).toBeTruthy();
  });
});

describe('local state validation', () => {
  it('returns defaults for missing, malformed, or incompatible data', () => {
    expect(parseStoredState(null)).toEqual(createDefaultState());
    expect(parseStoredState('{bad json')).toEqual(createDefaultState());
    expect(parseStoredState(JSON.stringify({ version: 2 }))).toEqual(
      createDefaultState(),
    );
  });

  it('accepts a valid current state', () => {
    const state = createDefaultState();
    state.difficultQuestionIds = ['law-114-01'];
    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
  });

  it('removes legacy random attempts from stored history', () => {
    const question = questions.find((item) => item.id === 'law-114-01');
    expect(question).toBeDefined();
    const paperAttempt = createAttempt({
      mode: 'paper',
      source: [question!],
      answers: { [question!.id]: firstAcceptedAnswer(question!) },
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 1,
    });
    const randomAttempt = {
      ...paperAttempt,
      id: 'random-attempt',
      mode: 'random' as const,
    };
    const stored = {
      ...createDefaultState(),
      attempts: [randomAttempt, paperAttempt],
    };

    expect(parseStoredState(JSON.stringify(stored)).attempts).toEqual([
      paperAttempt,
    ]);
  });

  it('drops only the corrupt records and keeps the rest of the user data', () => {
    const question = questions.find((item) => item.id === 'law-114-01');
    expect(question).toBeDefined();
    const attempt = createAttempt({
      mode: 'paper',
      source: [question!],
      answers: { [question!.id]: firstAcceptedAnswer(question!) },
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 1,
    });
    const partiallyCorruptState = {
      ...createDefaultState(),
      attempts: [{ ...attempt, subject: 'invalid-subject' }, attempt],
      difficultQuestionIds: ['law-114-01', 42],
      notes: { 'law-114-01': '保留這則筆記', 'law-114-02': { bad: true } },
    };

    const restored = parseStoredState(JSON.stringify(partiallyCorruptState));

    expect(restored.attempts).toEqual([attempt]);
    expect(restored.difficultQuestionIds).toEqual(['law-114-01']);
    expect(restored.notes).toEqual({ 'law-114-01': '保留這則筆記' });
  });
});

describe('result helpers', () => {
  it('formats correct answers without repeating option text', () => {
    const question = questions.find((item) => item.id === 'law-114-01');
    expect(question).toBeDefined();
    expect(formatCorrectAnswer(question!)).toBe('D');
  });

  it('calculates fixed per-question scores and subject maximums', () => {
    expect(calculateScore(1, 'law')).toBe(1.25);
    expect(calculateScore(80, 'construction')).toBe(100);
    expect(calculateScore(1, 'env')).toBe(1.5);
    expect(calculateScore(40, 'structure')).toBe(60);
    expect(calculateScore(0, 'law')).toBe(0);
    expect(getSubjectScoreConfig('law').maximumScore).toBe(100);
    expect(getSubjectScoreConfig('env').maximumScore).toBe(60);
  });

  it('draws the requested number of unique random items without exceeding the source', () => {
    const source = ['a', 'b', 'c', 'd'];
    expect(pickRandomItems(source, 2, () => 0)).toHaveLength(2);
    expect(new Set(pickRandomItems(source, 4, () => 0)).size).toBe(4);
    expect(pickRandomItems(source, 10, () => 0)).toHaveLength(4);
  });

  it('calculates complete submission totals and duration formatting', () => {
    const source = questions.slice(0, 3);
    const attempt = createAttempt({
      mode: 'paper',
      source,
      answers: { [source[0].id]: firstAcceptedAnswer(source[0]), [source[1].id]: 0 },
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 65,
    });
    expect(attempt.correctCount).toBe(1);
    expect(attempt.wrongCount).toBe(1);
    expect(attempt.unansweredCount).toBe(1);
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('groups repeated papers and identical random sets for attempt counts', () => {
    const paperQuestions = questions
      .filter((question) => question.subject === 'law' && question.year === 114)
      .slice(0, 2);
    const paper = createAttempt({
      mode: 'paper',
      source: paperQuestions,
      answers: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 1,
    });
    const random = { ...paper, mode: 'random' as const };

    expect(getAttemptScopeKey(paper)).toBe(getAttemptScopeKey({ ...paper }));
    expect(getAttemptScopeKey(random)).toBe(
      getAttemptScopeKey({
        ...random,
        questionIds: [...random.questionIds].reverse(),
      }),
    );
    expect(getAttemptScopeKey(paper)).not.toBe(getAttemptScopeKey(random));
  });

  it('accepts every corrected answer and awards all-credit questions without a selection', () => {
    const corrected = questions.find((question) => question.id === 'construction-114-49');
    expect(corrected).toBeDefined();
    expect(isQuestionCorrect(corrected!, 0)).toBe(true);
    expect(isQuestionCorrect(corrected!, 1)).toBe(true);
    expect(isQuestionCorrect(corrected!, 2)).toBe(false);

    const allCredit = {
      ...corrected!,
      id: 'all-credit',
      answerKey: { kind: 'all-credit' as const },
    };
    const attempt = createAttempt({
      mode: 'paper',
      source: [allCredit],
      answers: {},
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedSeconds: 1,
    });
    expect(attempt.correctCount).toBe(1);
    expect(attempt.wrongCount).toBe(0);
    expect(attempt.unansweredCount).toBe(0);
  });
});

describe('analysis', () => {
  it('keeps cross-year category totals aligned after importing 113', () => {
    const expectedCounts = {
      law: 160,
      env: 80,
      construction: 160,
      structure: 80,
    } as const;

    Object.entries(expectedCounts).forEach(([subject, expectedCount]) => {
      const source = questions.filter(
        (question) =>
          question.subject === subject &&
          (question.year === 113 || question.year === 114),
      );
      expect(source).toHaveLength(expectedCount);
      expect(
        getAnalysis(source).reduce((total, item) => total + item.count, 0),
      ).toBe(expectedCount);
    });

    const lawSource = questions.filter(
      (question) =>
        question.subject === 'law' &&
        (question.year === 113 || question.year === 114),
    );
    expect(
      getLawAnalysis(lawSource).reduce((total, item) => total + item.count, 0),
    ).toBeGreaterThanOrEqual(lawSource.length);
  });

  it('counts each question once through its primary category', () => {
    const source = questions.filter((question) => question.subject === 'law');
    const analysis = getAnalysis(source);
    expect(analysis.reduce((sum, item) => sum + item.count, 0)).toBe(source.length);
    expect(analysis.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
  });

  it('counts every related-law reference and sorts by frequency', () => {
    const analysis = getLawAnalysis([
      { relatedLaws: ['建築法', '建築技術規則'] },
      { relatedLaws: ['建築法'] },
      {},
    ]);
    expect(analysis.map(({ law, count }) => ({ law, count }))).toEqual([
      { law: '建築法', count: 2 },
      { law: '建築技術規則', count: 1 },
    ]);
    expect(analysis[0].percentage).toBeCloseTo(200 / 3);
    expect(analysis[1].percentage).toBeCloseTo(100 / 3);
  });

  it('uses a locale-independent order when analysis counts are tied', () => {
    const analysis = getLawAnalysis([{ relatedLaws: ['都市更新條例', '營造業法'] }]);

    expect(analysis.map((item) => item.law)).toEqual(['營造業法', '都市更新條例']);
  });

  it('keeps the law chart total aligned with every related-law reference', () => {
    const source = questions.filter(
      (question) => question.subject === 'law' && question.year === 114,
    );
    const primaryAnalysis = getAnalysis(source);
    const lawAnalysis = getLawAnalysis(source);

    expect(primaryAnalysis.reduce((sum, item) => sum + item.count, 0)).toBe(80);
    expect(lawAnalysis.reduce((sum, item) => sum + item.count, 0)).toBe(83);
    expect(lawAnalysis).toContainEqual(
      expect.objectContaining({ law: '法律常識', count: 1 }),
    );
    expect(lawAnalysis.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
  });
});
