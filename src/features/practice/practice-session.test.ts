import { describe, expect, it } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import {
  addPracticeTime,
  confirmPracticeAnswer,
  createPracticeAttempt,
  createPracticePaper,
  createPracticeSession,
  createPracticeSessionFromQuestions,
  createPracticeTimer,
  displayPracticeQuestion,
  getPracticeCategories,
  DEFAULT_PRACTICE_SETTINGS,
  getDisplayedQuestion,
  hasPracticeProgress,
  isDefaultPracticeSettings,
  movePracticeTo,
  parsePracticeSession,
  resetPracticeAnswers,
  resolvePracticePool,
  selectPracticeOption,
  summarizePractice,
  tickPracticeTimer,
  togglePracticeElimination,
  toOriginalOption,
  type PracticeSession,
} from './practice-session';

function makeQuestion(
  id: string,
  {
    subject = 'law',
    year = 114,
    law = '建築技術規則',
    answerKey = { kind: 'accepted', options: [0] },
    format,
  }: {
    subject?: SubjectId;
    year?: number;
    law?: string;
    answerKey?: Question['answerKey'];
    format?: Question['format'];
  } = {},
): Question {
  return {
    id,
    subject,
    year,
    questionNumber: Number(id.split('-').at(-1)) || 1,
    topic: law,
    primaryCategory: law,
    tags: [],
    relatedLaws: [law],
    text: id,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey,
    source: { kind: 'sample' },
    ...(format ? { format } : {}),
  };
}

/** Deterministic, so draws are reproducible. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function range(count: number, make: (index: number) => Question) {
  return Array.from({ length: count }, (_, index) => make(index));
}

function sessionWith(
  questions: Question[],
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  return {
    version: 1,
    id: 'session-1',
    subject: 'law',
    rangeStart: 100,
    rangeEnd: 114,
    category: 'all',
    questionIds: questions.map((question) => question.id),
    optionOrders: {},
    answers: {},
    drafts: {},
    eliminated: {},
    elapsedSeconds: {},
    currentIndex: 0,
    ...overrides,
  };
}

describe('resolvePracticePool', () => {
  const bank = [
    makeQuestion('law-114-01'),
    makeQuestion('law-114-02', { law: '建築法' }),
    makeQuestion('law-113-03', { year: 113 }),
    makeQuestion('law-112-04', { year: 112, law: '建築法' }),
    makeQuestion('law-114-05', { answerKey: { kind: 'all-credit' }, law: '建築法' }),
    makeQuestion('law-113-06', {
      year: 113,
      answerKey: { kind: 'accepted', options: [0, 1, 2, 3] },
    }),
    makeQuestion('law-114-07', { format: 'written', answerKey: { kind: 'written' } }),
    makeQuestion('env-114-01', { subject: 'env' }),
  ];

  it('defaults to the daily practice pool: no 一律給分, no written questions, other subjects ignored', () => {
    const pool = resolvePracticePool(bank, 'law', DEFAULT_PRACTICE_SETTINGS);
    expect(pool.candidates.map((question) => question.id)).toEqual([
      'law-114-01',
      'law-114-02',
      'law-113-03',
      'law-112-04',
    ]);
    expect(pool.eligibleCount).toBe(4);
    expect(pool.allCreditInRange).toBe(2);
    expect([pool.rangeStart, pool.rangeEnd]).toEqual([112, 114]);
    expect(isDefaultPracticeSettings(DEFAULT_PRACTICE_SETTINGS)).toBe(true);
  });

  it('adds 一律給分 questions, including keys that accept every option, only when asked', () => {
    const pool = resolvePracticePool(bank, 'law', {
      ...DEFAULT_PRACTICE_SETTINGS,
      includeAllCredit: true,
    });
    expect(pool.candidates.map((question) => question.id)).toEqual(
      expect.arrayContaining(['law-114-05', 'law-113-06']),
    );
    expect(pool.candidates).toHaveLength(6);
    expect(pool.candidates.some((question) => question.format === 'written')).toBe(false);
  });

  it('keeps an inclusive year range in either order and resets an unavailable year', () => {
    const reversed = resolvePracticePool(bank, 'law', {
      ...DEFAULT_PRACTICE_SETTINGS,
      fromYear: 114,
      toYear: 113,
    });
    expect([reversed.fromYear, reversed.toYear]).toEqual([114, 113]);
    expect([reversed.rangeStart, reversed.rangeEnd]).toEqual([113, 114]);
    expect(reversed.candidates.map((question) => question.id)).toEqual([
      'law-114-01',
      'law-114-02',
      'law-113-03',
    ]);
    const missingYear = resolvePracticePool(bank, 'law', {
      ...DEFAULT_PRACTICE_SETTINGS,
      fromYear: 101,
    });
    expect(missingYear.fromYear).toBe(112);
  });

  it('counts categories within the range and falls back to all for an unknown one', () => {
    const pool = resolvePracticePool(bank, 'law', {
      ...DEFAULT_PRACTICE_SETTINGS,
      category: '建築法',
    });
    expect(pool.categories).toEqual(
      expect.arrayContaining([
        { name: '建築法', count: 2 },
        { name: '建築技術規則', count: 2 },
      ]),
    );
    expect(pool.candidates.map((question) => question.id)).toEqual([
      'law-114-02',
      'law-112-04',
    ]);
    const unknown = resolvePracticePool(bank, 'law', {
      ...DEFAULT_PRACTICE_SETTINGS,
      category: '不存在',
    });
    expect(unknown.category).toBe('all');
  });

  it('offers the counts that fit, plus the whole pool when it is under 50', () => {
    const fortyThree = range(43, (index) => makeQuestion(`law-114-${index + 1}`));
    const small = resolvePracticePool(fortyThree, 'law', DEFAULT_PRACTICE_SETTINGS);
    expect(small.countOptions).toEqual([5, 10, 15, 20, 30, 43]);
    expect(small.count).toBe(43);
    expect(
      resolvePracticePool(fortyThree, 'law', { ...DEFAULT_PRACTICE_SETTINGS, count: 20 })
        .count,
    ).toBe(20);

    const sixty = range(60, (index) => makeQuestion(`law-114-${index + 1}`));
    const large = resolvePracticePool(sixty, 'law', DEFAULT_PRACTICE_SETTINGS);
    expect(large.countOptions).toEqual([5, 10, 15, 20, 30, 50]);
    expect(large.count).toBe(50);

    const three = resolvePracticePool(sixty.slice(0, 3), 'law', {
      ...DEFAULT_PRACTICE_SETTINGS,
      count: 10,
    });
    expect(three.countOptions).toEqual([3]);
    expect(three.count).toBe(3);

    const none = resolvePracticePool([], 'law', DEFAULT_PRACTICE_SETTINGS);
    expect(none.countOptions).toEqual([]);
    expect(none.count).toBe(0);
  });
});

describe('createPracticeSession', () => {
  const bank = range(60, (index) => makeQuestion(`law-114-${index + 1}`));
  const pool = resolvePracticePool(bank, 'law', DEFAULT_PRACTICE_SETTINGS);

  it('draws the requested number of distinct questions with a fixed option order each', () => {
    const session = createPracticeSession(pool, 'law', true, seeded(1));
    expect(session.questionIds).toHaveLength(50);
    expect(new Set(session.questionIds).size).toBe(50);
    expect(
      session.questionIds.every((id) => bank.some((question) => question.id === id)),
    ).toBe(true);
    for (const id of session.questionIds) {
      expect([...session.optionOrders[id]].sort()).toEqual([0, 1, 2, 3]);
    }
    expect(session).toMatchObject({
      answers: {},
      drafts: {},
      currentIndex: 0,
      rangeStart: 114,
      rangeEnd: 114,
    });
  });

  it('redraws on every call and keeps the original order when shuffling is off', () => {
    const first = createPracticeSession(pool, 'law', false, seeded(1));
    const second = createPracticeSession(pool, 'law', false, seeded(2));
    expect(first.questionIds).not.toEqual(second.questionIds);
    expect(first.optionOrders).toEqual({});
    expect(first.id).not.toBe(second.id);
  });
});

describe('answering', () => {
  const question = makeQuestion('law-114-01');
  const other = makeQuestion('law-114-02');
  const session = sessionWith([question, other], {
    optionOrders: { [question.id]: [2, 0, 3, 1] },
  });
  const displayed = getDisplayedQuestion(session, question);

  it('grades against the displayed order and then locks the question', () => {
    expect(displayed.options).toEqual(['選項 C', '選項 A', '選項 D', '選項 B']);
    const drafted = selectPracticeOption(session, question.id, 1);
    expect(drafted.answers).toEqual({});
    const confirmed = confirmPracticeAnswer(drafted, displayed);
    expect(confirmed.answers[question.id]).toEqual({ selected: 1, correct: true });
    expect(confirmed.drafts[question.id]).toBeUndefined();
    expect(selectPracticeOption(confirmed, question.id, 0)).toBe(confirmed);
    expect(togglePracticeElimination(confirmed, question.id, 3)).toBe(confirmed);
    expect(confirmPracticeAnswer(confirmed, displayed)).toBe(confirmed);
  });

  it('marks a wrong answer and ignores a confirmation without a selection', () => {
    expect(confirmPracticeAnswer(session, displayed)).toBe(session);
    const wrong = confirmPracticeAnswer(
      selectPracticeOption(session, question.id, 0),
      displayed,
    );
    expect(wrong.answers[question.id]).toEqual({ selected: 0, correct: false });
  });

  it('keeps drafts and eliminations per question and never eliminates the selection', () => {
    const drafted = selectPracticeOption(session, other.id, 2);
    expect(togglePracticeElimination(drafted, other.id, 2)).toBe(drafted);
    const eliminated = togglePracticeElimination(drafted, other.id, 3);
    expect(eliminated.eliminated[other.id]).toEqual([3]);
    expect(
      togglePracticeElimination(eliminated, other.id, 3).eliminated[other.id],
    ).toBeUndefined();
    expect(selectPracticeOption(session, 'law-999-99', 1)).toBe(session);
  });

  it('counts time only while a question is still open', () => {
    const ticked = tickPracticeTimer(
      tickPracticeTimer(session, question.id),
      question.id,
    );
    expect(ticked.elapsedSeconds[question.id]).toBe(2);
    const confirmed = confirmPracticeAnswer(
      selectPracticeOption(ticked, question.id, 1),
      displayed,
    );
    expect(tickPracticeTimer(confirmed, question.id)).toBe(confirmed);
  });

  it('clamps navigation to the set', () => {
    expect(movePracticeTo(session, 9).currentIndex).toBe(1);
    expect(movePracticeTo(session, -3).currentIndex).toBe(0);
    expect(movePracticeTo(session, 0)).toBe(session);
  });
});

describe('summarizePractice and resetPracticeAnswers', () => {
  const questions = range(5, (index) => makeQuestion(`law-114-${index + 1}`));
  const session = sessionWith(questions, {
    answers: {
      'law-114-1': { selected: 0, correct: true },
      'law-114-2': { selected: 1, correct: false },
      'law-114-4': { selected: 0, correct: true },
    },
    drafts: { 'law-114-3': 2 },
    eliminated: { 'law-114-5': [1] },
    elapsedSeconds: { 'law-114-1': 12, 'law-114-2': 30, 'law-114-3': 4 },
    currentIndex: 3,
  });

  it('reports unanswered questions separately from the accuracy', () => {
    expect(summarizePractice(session)).toEqual({
      total: 5,
      answered: 3,
      correct: 2,
      wrong: 1,
      unanswered: 2,
      accuracy: 67,
      wrongIds: ['law-114-2'],
      elapsedSeconds: 46,
    });
    expect(summarizePractice(sessionWith(questions)).accuracy).toBeNull();
  });

  it('returns the same questions and option order with nothing answered', () => {
    const ordered = { ...session, optionOrders: { 'law-114-1': [1, 0, 2, 3] } };
    const blank = resetPracticeAnswers(ordered);
    expect(blank).toMatchObject({
      id: ordered.id,
      questionIds: ordered.questionIds,
      optionOrders: ordered.optionOrders,
      answers: {},
      drafts: {},
      eliminated: {},
      elapsedSeconds: {},
      currentIndex: 0,
    });
    expect(hasPracticeProgress(blank)).toBe(false);
    expect(hasPracticeProgress(tickPracticeTimer(blank, 'law-114-1'))).toBe(true);
  });
});

describe('createPracticePaper', () => {
  it('clears unconfirmed choices but preserves the question and never clears confirmed answers', () => {
    const question = makeQuestion('law-114-01');
    const session = sessionWith([question], {
      drafts: { [question.id]: 1 }, eliminated: { [question.id]: [2] }, elapsedSeconds: { [question.id]: 8 },
    });
    const cleared = selectPracticeOption(session, question.id, undefined);
    expect(cleared).toEqual({ ...session, drafts: {} });
    expect(parsePracticeSession(JSON.stringify(cleared))?.drafts).toEqual({});
    const locked = confirmPracticeAnswer(selectPracticeOption(cleared, question.id, 0), question);
    expect(selectPracticeOption(locked, question.id, undefined)).toBe(locked);
  });

  it('prints the displayed option order with a matching answer key', () => {
    const first = makeQuestion('law-114-01');
    const second = makeQuestion('law-113-02', {
      year: 113,
      answerKey: { kind: 'all-credit' },
    });
    const session = sessionWith([first, second], {
      optionOrders: { [first.id]: [3, 2, 1, 0] },
    });
    const paper = createPracticePaper(
      session,
      new Map([first, second].map((question) => [question.id, question])),
      '2026-10-22',
    );
    expect(paper).toMatchObject({
      date: '2026-10-22',
      subjectName: '建築法規與實務',
    });
    expect(paper.questions[0].options).toEqual(['選項 D', '選項 C', '選項 B', '選項 A']);
    expect(paper.referenceAnswers).toEqual(['D', '本題一律給分']);
    expect(() => createPracticePaper(session, new Map(), '2026-10-22')).toThrow(
      '題目尚未完整載入',
    );
  });
});

describe('parsePracticeSession', () => {
  const questions = range(3, (index) => makeQuestion(`law-114-${index + 1}`));
  const session = sessionWith(questions, {
    optionOrders: { 'law-114-1': [1, 0, 3, 2] },
    answers: { 'law-114-1': { selected: 2, correct: false } },
    drafts: { 'law-114-2': 1 },
    eliminated: { 'law-114-3': [2, 0] },
    elapsedSeconds: { 'law-114-1': 9 },
    currentIndex: 2,
  });

  it('round-trips a stored set', () => {
    expect(parsePracticeSession(JSON.stringify(session))).toEqual({
      ...session,
      eliminated: { 'law-114-3': [0, 2] },
    });
  });

  it('rejects what cannot be a set', () => {
    expect(parsePracticeSession(null)).toBeNull();
    expect(parsePracticeSession('{')).toBeNull();
    expect(parsePracticeSession(JSON.stringify({ ...session, version: 2 }))).toBeNull();
    expect(
      parsePracticeSession(JSON.stringify({ ...session, subject: 'math' })),
    ).toBeNull();
    expect(
      parsePracticeSession(JSON.stringify({ ...session, questionIds: [] })),
    ).toBeNull();
  });

  it('drops entries that do not parse and clamps the position', () => {
    const restored = parsePracticeSession(
      JSON.stringify({
        ...session,
        rangeStart: 114,
        rangeEnd: 105,
        optionOrders: { 'law-114-1': [0, 0, 1, 2], 'law-114-2': [1, 0, 2, 3] },
        answers: {
          'law-114-1': { selected: -1, correct: true },
          'law-999-1': { selected: 0, correct: true },
        },
        drafts: { 'law-114-2': 'A', 'law-114-3': 3 },
        elapsedSeconds: { 'law-114-1': -4, 'law-114-2': 7 },
        currentIndex: 99,
      }),
    );
    expect(restored).toMatchObject({
      rangeStart: 105,
      rangeEnd: 114,
      optionOrders: { 'law-114-2': [1, 0, 2, 3] },
      answers: {},
      drafts: { 'law-114-3': 3 },
      elapsedSeconds: { 'law-114-2': 7 },
      currentIndex: 2,
    });
  });
});

describe('getPracticeCategories', () => {
  it('folds compatibility ideographs and drops placeholder tags', () => {
    const compat = makeQuestion('law-100-39', {
      law: '都市計畫公共設施保\uF9CD地\uF9F6時建築使用辦法',
    });
    expect(getPracticeCategories(compat)).toEqual([
      '都市計畫公共設施保留地臨時建築使用辦法',
    ]);
    const placeholder = {
      ...makeQuestion('law-104-47'),
      relatedLaws: ['???'],
      topic: '未知',
      primaryCategory: '其他營建法規',
    };
    expect(getPracticeCategories(placeholder)).toEqual(['其他營建法規']);
    const abolished = { ...makeQuestion('law-103-73'), relatedLaws: ['廢止', '建築法'] };
    expect(getPracticeCategories(abolished)).toEqual(['建築法']);
  });

  it('counts one category for both spellings of the same law', () => {
    const pool = resolvePracticePool(
      [
        makeQuestion('law-112-01', {
          year: 112,
          law: '都市計畫公共設施保留地臨時建築使用辦法',
        }),
        makeQuestion('law-100-39', {
          year: 100,
          law: '都市計畫公共設施保\uF9CD地\uF9F6時建築使用辦法',
        }),
      ],
      'law',
      {
        ...DEFAULT_PRACTICE_SETTINGS,
        category: '都市計畫公共設施保留地臨時建築使用辦法',
      },
    );
    expect(pool.categories).toEqual([
      { name: '都市計畫公共設施保留地臨時建築使用辦法', count: 2 },
    ]);
    expect(pool.candidates).toHaveLength(2);
  });
});

describe('practice paper note and stored strike-outs', () => {
  it('says the options keep the exam order only when they were not shuffled', () => {
    const question = makeQuestion('law-114-01');
    const byId = new Map([[question.id, question]]);
    expect(
      createPracticePaper(sessionWith([question]), byId, '2026-10-22').answerKeyNote,
    ).toBe('依本次每日題號對照，非原試卷題號；選項為原試卷順序。');
    const shuffled = sessionWith([question], {
      optionOrders: { [question.id]: [1, 0, 2, 3] },
    });
    expect(
      createPracticePaper(shuffled, byId, '2026-10-22').answerKeyNote,
    ).toBeUndefined();
  });

  it('keeps struck-out options on answered questions when restoring', () => {
    const questions = range(2, (index) => makeQuestion(`law-114-${index + 1}`));
    const session = sessionWith(questions, {
      answers: { 'law-114-1': { selected: 0, correct: true } },
      eliminated: { 'law-114-1': [2, 3] },
    });
    expect(parsePracticeSession(JSON.stringify(session))!.eliminated).toEqual({
      'law-114-1': [2, 3],
    });
  });
});

describe('createPracticeTimer', () => {
  it('holds seconds for one question until they are taken into the session', () => {
    const question = makeQuestion('law-114-01');
    const timer = createPracticeTimer();
    const seen: number[] = [];
    const unsubscribe = timer.subscribe(() => seen.push(timer.getSeconds()));
    timer.tick(question.id);
    timer.tick(question.id);
    expect(timer.getSeconds()).toBe(2);
    const pending = timer.take();
    expect(pending).toEqual({ questionId: question.id, seconds: 2 });
    expect(timer.getSeconds()).toBe(0);
    expect(timer.take()).toBeNull();
    expect(seen).toEqual([1, 2, 0]);
    unsubscribe();
    const session = sessionWith([question]);
    expect(addPracticeTime(session, pending).elapsedSeconds).toEqual({
      [question.id]: 2,
    });
    expect(addPracticeTime(session, null)).toBe(session);
  });

  it('starts over when the open question changes without being taken', () => {
    const timer = createPracticeTimer();
    timer.tick('law-114-01');
    timer.tick('law-114-02');
    expect(timer.take()).toEqual({ questionId: 'law-114-02', seconds: 1 });
  });
});

describe('practice records', () => {
  const questions = [
    makeQuestion('law-114-01'),
    makeQuestion('law-113-02'),
    makeQuestion('law-110-03', { answerKey: { kind: 'all-credit' } }),
  ];
  const byId = new Map(questions.map((question) => [question.id, question]));
  function practiceSet(overrides: Partial<PracticeSession>): PracticeSession {
    return {
      version: 1,
      id: 'set',
      subject: 'law',
      rangeStart: 110,
      rangeEnd: 114,
      category: 'all',
      questionIds: questions.map((question) => question.id),
      optionOrders: {},
      answers: {},
      drafts: {},
      eliminated: {},
      elapsedSeconds: {},
      currentIndex: 0,
      ...overrides,
    };
  }

  it('maps a choice on the shuffled screen back to the paper’s option', () => {
    expect(toOriginalOption(questions[0], [2, 0, 3, 1], 0)).toBe(2);
    expect(toOriginalOption(questions[0], undefined, 3)).toBe(3);
    // An order that does not fit the question was never shown.
    expect(toOriginalOption(questions[0], [1, 0], 0)).toBe(0);
    expect(toOriginalOption(questions[0], [0, 0, 1, 2], 1)).toBe(1);
  });

  it('records the numbers of the result page, and nothing for an empty submission', () => {
    expect(createPracticeAttempt(practiceSet({}), byId)).toBeNull();

    const record = createPracticeAttempt(
      practiceSet({
        optionOrders: { 'law-114-01': [1, 0, 2, 3] },
        answers: {
          'law-114-01': { selected: 1, correct: true },
          'law-113-02': { selected: 2, correct: false },
        },
        elapsedSeconds: { 'law-114-01': 20, 'law-113-02': 10, 'law-110-03': 5 },
      }),
      byId,
      '2026-10-20T00:10:00.000Z',
    )!;

    expect(record.attempt).toMatchObject({
      mode: 'practice',
      subject: 'law',
      year: null,
      questionIds: ['law-114-01', 'law-113-02', 'law-110-03'],
      answers: { 'law-114-01': 0, 'law-113-02': 2 },
      submittedAt: '2026-10-20T00:10:00.000Z',
      startedAt: '2026-10-20T00:09:25.000Z',
      elapsedSeconds: 35,
      // The blank 一律給分 question counts as unanswered, as on the result page.
      correctCount: 1,
      wrongCount: 1,
      unansweredCount: 1,
    });
    expect(record.attempt.id).toMatch(/^attempt-2026-10-20T00:10:00.000Z-/);
    expect(record.results).toEqual({ 'law-114-01': true, 'law-113-02': false });
  });

  it('starts exactly the recorded questions again, describing them', () => {
    const shared = [
      makeQuestion('law-114-01', { law: '建築法' }),
      makeQuestion('law-105-02', { year: 105, law: '建築法' }),
    ];
    const session = createPracticeSessionFromQuestions(shared, 'law', true, seeded(3));

    expect(session).toMatchObject({
      subject: 'law',
      rangeStart: 105,
      rangeEnd: 114,
      category: '建築法',
      questionIds: ['law-114-01', 'law-105-02'],
      answers: {},
      currentIndex: 0,
    });
    expect(Object.keys(session.optionOrders)).toEqual(['law-114-01', 'law-105-02']);
    expect([...session.optionOrders['law-114-01']].sort()).toEqual([0, 1, 2, 3]);

    const mixed = createPracticeSessionFromQuestions(
      [...shared, makeQuestion('law-110-03', { year: 110 })],
      'law',
      false,
    );
    expect(mixed.category).toBe('all');
    expect(mixed.optionOrders).toEqual({});
  });
});

describe('displayPracticeQuestion', () => {
  it('shows the stored option order and remaps the key, ignoring an order that does not fit', () => {
    const question = makeQuestion('law-114-01', {
      answerKey: { kind: 'accepted', options: [0] },
    });

    expect(displayPracticeQuestion(question, [2, 0, 3, 1])).toMatchObject({
      options: ['選項 C', '選項 A', '選項 D', '選項 B'],
      answerKey: { kind: 'accepted', options: [1] },
    });
    expect(displayPracticeQuestion(question, [0, 0, 1, 2])).toBe(question);
    expect(displayPracticeQuestion(question, [1, 0])).toBe(question);
    expect(displayPracticeQuestion(question, undefined)).toBe(question);
  });
});
