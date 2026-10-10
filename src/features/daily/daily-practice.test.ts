import { describe, expect, it } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import {
  applyDailyOptionOrder,
  activateDailyGuard,
  countDailyWrongAnswers,
  createDailyCompletionResult,
  createDailyPracticeSession,
  DAILY_QUESTIONS_PER_SUBJECT,
  DAILY_STAGES,
  getDailyLifeState,
  getDailyCombatState,
  getDailyRelicInventory,
  getDailyRemainingTimeMs,
  getDailyStageBounds,
  getDailyStageIndex,
  getMillisecondsUntilTaipeiMidnight,
  parseDailyCompletionRecord,
  parseDailyPracticeSession,
  shouldEnterDailyReview,
} from './daily-practice';

function question(subject: SubjectId, number: number): Question {
  return {
    id: `${subject}-114-${String(number).padStart(2, '0')}`,
    subject,
    year: 114,
    questionNumber: number,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `第 ${number} 題`,
    content: [{ kind: 'text', text: `第 ${number} 題` }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

describe('daily practice', () => {
  it('drains timed HP continuously while keeping stage mistake capacity unchanged', () => {
    const session = createDailyPracticeSession(Array.from({ length: 6 }, (_, i) => question('law', i + 1)), ['law']);
    session.questionDeadlineMs = 61_000;
    expect(getDailyCombatState(session, 1000).timedHpRatio).toBe(1);
    expect(getDailyCombatState(session, 31_000).timedHpRatio).toBe(.5);
    expect(getDailyCombatState(session, 61_000).timedHpRatio).toBe(0);
    session.answers[session.questionIds[0]] = { selected: 1, correct: false };
    session.currentIndex = 1;
    expect(getDailyCombatState(session, 31_000).timedHpRatio).toBeCloseTo(1 / 3);
    expect(getDailyLifeState(session.questionIds, session.answers).remaining).toBe(2);
  });

  it('pauses the attack and timed HP drain after answering or during review', () => {
    const session = createDailyPracticeSession([question('law', 1)], ['law']);
    session.questionDeadlineMs = 61_000;
    session.answers[session.questionIds[0]] = { selected: 0, correct: true };
    expect(getDailyCombatState(session, 50_000)).toMatchObject({ active: false, timedHpRatio: 1 });
    session.status = 'review';
    expect(getDailyCombatState(session, 70_000).active).toBe(false);
  });

  it('awards a perfect guard only inside the telegraphed window and only once per stage', () => {
    const session = createDailyPracticeSession(Array.from({ length: 6 }, (_, i) => question('law', i + 1)), ['law']);
    session.questionDeadlineMs = 55_000;
    const guarded = activateDailyGuard(session, 1000);
    expect(guarded.guardUses?.[session.questionIds[0]]).toBe('perfect');
    expect(guarded.questionDeadlineMs).toBe(60_000);
    expect(guarded.guardUntilMs).toBe(4000);
    expect(getDailyCombatState(guarded, 2000).guarding).toBe(true);
    expect(getDailyCombatState(guarded, 4000).guarding).toBe(false);
    expect(activateDailyGuard(guarded, 2000)).toBe(guarded);
    guarded.currentIndex = 1;
    expect(getDailyCombatState(guarded, 2000).guardAvailable).toBe(false);
    guarded.currentIndex = 5;
    expect(getDailyCombatState(guarded, 2000).guardAvailable).toBe(true);
  });

  it('gives an early guard only two seconds and never permits guarding after timeout', () => {
    const session = createDailyPracticeSession([question('law', 1)], ['law']);
    session.questionDeadlineMs = 61_000;
    const guarded = activateDailyGuard(session, 1000);
    expect(guarded.guardUses?.[session.questionIds[0]]).toBe('early');
    expect(guarded.questionDeadlineMs).toBe(63_000);
    expect(guarded.guardUntilMs).toBeUndefined();
    expect(activateDailyGuard(session, 61_000)).toBe(session);
  });

  it('restores guard consumption and removes duplicate or invalid saved guards', () => {
    const session = createDailyPracticeSession(Array.from({ length: 6 }, (_, i) => question('law', i + 1)), ['law'], '2026-10-11');
    const [first, second] = session.questionIds;
    session.guardUses = { [first]: 'perfect', [second]: 'early', invalid: 'perfect' };
    session.guardUntilMs = 4000;
    const restored = parseDailyPracticeSession(JSON.stringify(session), '2026-10-11')!;
    expect(restored.guardUses).toEqual({ [first]: 'perfect' });
    expect(getDailyCombatState(restored, 2000).guardAvailable).toBe(false);
  });

  it('telegraphs attacks and enrages at low boss HP with an uninterrupted third-hit combo', () => {
    const session = createDailyPracticeSession(Array.from({ length: 5 }, (_, i) => question('law', i + 1)), ['law']);
    session.currentIndex = 2;
    session.answers = Object.fromEntries(session.questionIds.slice(0, 3).map(id => [id, { selected: 0, correct: true }]));
    const combat = getDailyCombatState(session, 1000);
    expect(combat).toMatchObject({ chain: 3, enraged: true, cycleMs: 5000, bossRemaining: 2 });
  });

  it('draws fifty questions for only the selected subject', () => {
    const questions = (['law', 'env'] as const).flatMap((subject) =>
      Array.from({ length: 60 }, (_, index) => question(subject, index + 1)),
    );

    const session = createDailyPracticeSession(
      questions,
      ['law', 'env'],
      '2026-10-07',
      () => 0.5,
    );

    expect(session.questionIds).toHaveLength(DAILY_QUESTIONS_PER_SUBJECT);
    expect(session.subjects).toEqual(['law']);
    expect(session.questionIds.filter((id) => id.startsWith('law-'))).toHaveLength(50);
    expect(session.questionIds.filter((id) => id.startsWith('env-'))).toHaveLength(0);
    expect(new Set(session.questionIds)).toHaveLength(50);
    expect(Object.keys(session.optionOrders)).toHaveLength(50);
  });

  it('requires review only at a level boundary', () => {
    expect(shouldEnterDailyReview(3, 50, 3)).toBe(false);
    expect(shouldEnterDailyReview(5, 50, 1)).toBe(true);
    expect(shouldEnterDailyReview(5, 50, 0)).toBe(true);
    expect(shouldEnterDailyReview(10, 50, 1)).toBe(false);
    expect(shouldEnterDailyReview(11, 50, 1)).toBe(true);
    expect(shouldEnterDailyReview(18, 50, 0)).toBe(true);
    expect(shouldEnterDailyReview(50, 50, 1)).toBe(true);
  });

  it('maps all fifty questions into the six requested stages', () => {
    expect(DAILY_STAGES.map((stage) => stage.questions)).toEqual([5, 6, 7, 8, 9, 15]);
    expect(DAILY_STAGES.map((stage) => stage.wrongLimit)).toEqual([3, 3, 4, 4, 3, 3]);
    expect(getDailyStageIndex(0)).toBe(0);
    expect(getDailyStageIndex(5)).toBe(1);
    expect(getDailyStageIndex(49)).toBe(5);
    expect(getDailyStageBounds(4)).toEqual({ start: 26, end: 35 });
  });

  it('counts all mistakes even after pending review items are cleared', () => {
    expect(countDailyWrongAnswers({
      first: { selected: 1, correct: false },
      second: { selected: 0, correct: true },
      third: { selected: 2, correct: false },
    })).toBe(2);
  });

  it('restores one stage life after three consecutive correct answers', () => {
    const questionIds = ['wrong', 'first', 'second', 'third', 'fourth'];
    const answers = {
      wrong: { selected: 1, correct: false },
      first: { selected: 0, correct: true },
      second: { selected: 0, correct: true },
      third: { selected: 0, correct: true },
      fourth: { selected: 0, correct: true },
    };

    expect(getDailyLifeState(questionIds, answers, [], 4)).toEqual({
      remaining: 3,
      maximum: 3,
      restored: 1,
      streak: 1,
      relicsEarned: 0,
      stageIndex: 0,
      failed: false,
    });
  });

  it('awards rotating relics for full-health streaks and flawless levels', () => {
    const questionIds = ['first', 'second', 'third', 'fourth', 'fifth'];
    const answers = Object.fromEntries(
      questionIds.map((id) => [id, { selected: 0, correct: true }]),
    );

    expect(getDailyLifeState(questionIds, answers).relicsEarned).toBe(2);
    expect(getDailyRelicInventory(questionIds, answers)).toEqual({
      eliminate: 1,
      barrier: 1,
    });
    expect(getDailyRelicInventory(questionIds, answers, { sixth: 'eliminate' })).toEqual({
      eliminate: 0,
      barrier: 1,
    });
  });

  it('prevents life loss while the barrier protects a wrong answer', () => {
    const questionIds = Array.from({ length: 2 }, (_, index) => `wrong-${index}`);
    const answers = Object.fromEntries(
      questionIds.map((id) => [id, { selected: 1, correct: false }]),
    );

    expect(getDailyLifeState(questionIds, answers, ['wrong-0'], 1).remaining).toBe(2);
  });

  it('counts down from the stored question deadline', () => {
    expect(getDailyRemainingTimeMs(undefined, 12_000)).toBe(60_000);
    expect(getDailyRemainingTimeMs(38_000, 18_000)).toBe(20_000);
    expect(getDailyRemainingTimeMs(38_000, 20_000)).toBe(18_000);
  });

  it('preserves timeout defeat after reloading the session', () => {
    const session = createDailyPracticeSession(
      [question('law', 1)], ['law'], '2026-10-07',
    );
    session.answers[session.questionIds[0]] = {
      selected: -1, correct: false, timedOut: true,
    };
    session.currentIndex = 1;
    session.status = 'failed';
    expect(parseDailyPracticeSession(
      JSON.stringify(session), '2026-10-07',
    )?.status).toBe('failed');
  });

  it('creates a persisted completion score for the subject selection page', () => {
    expect(createDailyCompletionResult({
      first: { selected: 0, correct: true },
      second: { selected: 2, correct: false },
    }, 'failed')).toEqual({
      answered: 2,
      correct: 1,
      status: 'failed',
    });
  });

  it('reorders answer choices together with the accepted answer', () => {
    const reordered = applyDailyOptionOrder(question('law', 1), [2, 0, 3, 1]);

    expect(reordered.options).toEqual(['C', 'A', 'D', 'B']);
    expect(reordered.answerKey).toEqual({ kind: 'accepted', options: [1] });
  });

  it('refreshes at the next Taipei midnight instead of after 24 hours', () => {
    expect(
      getMillisecondsUntilTaipeiMidnight(new Date('2026-10-07T15:59:00.000Z')),
    ).toBe(60_000);
    expect(
      getMillisecondsUntilTaipeiMidnight(new Date('2026-10-07T16:01:00.000Z')),
    ).toBe(86_340_000);
  });

  it('restores only a valid session from the same Taipei date', () => {
    const session = createDailyPracticeSession(
      [question('law', 1)],
      ['law'],
      '2026-10-07',
    );
    session.answers[session.questionIds[0]] = { selected: 1, correct: false };

    expect(
      parseDailyPracticeSession(JSON.stringify(session), '2026-10-07'),
    ).toEqual(session);
    expect(
      parseDailyPracticeSession(JSON.stringify(session), '2026-10-08'),
    ).toBeNull();
    expect(parseDailyPracticeSession('{broken', '2026-10-07')).toBeNull();
  });

  it('fails when the first-stage third life is lost', () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 5 }, (_, index) => question('law', index + 1)),
      ['law'],
      '2026-10-07',
    );
    session.currentIndex = 3;
    session.answers = Object.fromEntries(
      session.questionIds.slice(0, 3).map((id) => [id, { selected: 1, correct: false }]),
    );
    session.unreviewedWrongIds = session.questionIds.slice(0, 3);
    session.status = 'practice';

    expect(
      parseDailyPracticeSession(JSON.stringify(session), '2026-10-07')?.status,
    ).toBe('failed');
  });

  it('keeps a session active when a three-answer streak restores stage life', () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 5 }, (_, index) => question('law', index + 1)),
      ['law'],
      '2026-10-07',
    );
    session.currentIndex = 4;
    session.answers = Object.fromEntries([
      [session.questionIds[0], { selected: 1, correct: false }],
      ...session.questionIds.slice(1, 4).map((id) => [id, { selected: 0, correct: true }]),
    ]);
    session.unreviewedWrongIds = [session.questionIds[0]];
    session.status = 'failed';

    expect(getDailyLifeState(session.questionIds, session.answers, [], 3)).toEqual({
      remaining: 3,
      maximum: 3,
      restored: 1,
      streak: 0,
      relicsEarned: 0,
      stageIndex: 0,
      failed: false,
    });
    expect(
      parseDailyPracticeSession(JSON.stringify(session), '2026-10-07')?.status,
    ).toBe('practice');
  });

  it('preserves defeat on the last question of a stage instead of using the next stage life', () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 6 }, (_, index) => question('law', index + 1)),
      ['law'],
      '2026-10-07',
    );
    session.currentIndex = 5;
    session.status = 'failed';
    session.answers = Object.fromEntries(session.questionIds.slice(0, 5).map((id, index) => [
      id, { selected: index % 2 === 0 && index !== 4 ? 0 : 1, correct: index % 2 === 0 && index !== 4 },
    ]));

    const restored = parseDailyPracticeSession(JSON.stringify(session), '2026-10-07');
    expect(restored?.status).toBe('failed');
    expect(restored?.currentIndex).toBe(5);
  });

  it('resets stage life after clearing the previous boss', () => {
    const session = createDailyPracticeSession(
      Array.from({ length: 6 }, (_, index) => question('law', index + 1)),
      ['law'],
      '2026-10-07',
    );
    session.currentIndex = 5;
    session.answers = Object.fromEntries([
      ...session.questionIds.slice(0, 2).map((id) => [id, { selected: 1, correct: false }]),
      ...session.questionIds.slice(2, 5).map((id) => [id, { selected: 0, correct: true }]),
      [session.questionIds[5], { selected: 1, correct: false }],
    ]);
    session.unreviewedWrongIds = [];
    session.status = 'failed';

    const restored = parseDailyPracticeSession(JSON.stringify(session), '2026-10-07');
    expect(restored?.status).toBe('practice');
    expect(getDailyLifeState(
      restored!.questionIds,
      restored!.answers,
      restored!.protectedWrongIds,
      5,
    ).remaining).toBe(2);
  });

  it('keeps completion results only on the recorded date', () => {
    const record = JSON.stringify({
      date: '2026-10-07',
      subjects: ['law', 'env', 'invalid'],
    });

    expect(parseDailyCompletionRecord(record, '2026-10-07')).toEqual({
      date: '2026-10-07',
      subjects: ['law', 'env'],
      results: {},
    });
    expect(parseDailyCompletionRecord(record, '2026-10-08')).toEqual({
      date: '2026-10-08',
      subjects: [],
      results: {},
    });
  });

  it('restores valid completion scores and ignores malformed ones', () => {
    const record = JSON.stringify({
      date: '2026-10-07',
      subjects: ['law', 'env'],
      results: {
        law: { answered: 50, correct: 46, status: 'completed' },
        env: { answered: 3, correct: 4, status: 'failed' },
      },
    });

    expect(parseDailyCompletionRecord(record, '2026-10-07')).toEqual({
      date: '2026-10-07',
      subjects: ['law', 'env'],
      results: {
        law: { answered: 50, correct: 46, status: 'completed' },
      },
    });
  });
});
