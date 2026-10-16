import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/types';
import {
  activateDailyGuard, advanceDailyQuestion, answerDailyQuestion, applyDailyOptionOrder,
  createDailyCompletionResult, createDailyPracticeSession, DAILY_MAX_RUN_QUESTIONS, DAILY_STAGES,
  finishDailyStageReview, getDailyCombatState, getDailyHealth, getDailyRelicInventory,
  getDailyRemainingTimeMs, getDailyRunState, getDailyStageTheme, getMillisecondsUntilTaipeiMidnight,
  getTaipeiDateKey, parseDailyCompletionRecord, parseDailyPracticeSession, pauseDailyQuestion,
  settleDailyHealth, startDailyQuestion, type DailyMode, type DailyPracticeSession,
} from './daily-practice';

const questions: Question[] = Array.from({ length: 90 }, (_, i) => ({
  id: 'law-' + i, subject: 'law', year: 114, questionNumber: i + 1,
  topic: '測試', primaryCategory: '測試', tags: [], text: '題目',
  content: [{ kind: 'text', text: '題目' }], options: ['A', 'B', 'C', 'D'],
  answerKey: { kind: 'accepted', options: [0] }, source: { kind: 'sample' },
}));
function run(mode: DailyMode = 'adventure') {
  return startDailyQuestion(createDailyPracticeSession(questions, ['law'], '2026-10-11', () => .5, mode), 1000);
}
function answer(session: DailyPracticeSession, correct: boolean, at = 1000) {
  return answerDailyQuestion(session, correct ? 0 : 1, correct, at);
}
function next(session: DailyPracticeSession, at = 1000) {
  return startDailyQuestion(advanceDailyQuestion(session), at);
}
function review(session: DailyPracticeSession, at = 1000) {
  return startDailyQuestion(finishDailyStageReview({ ...session, reviewedWrongIds: [...session.unreviewedWrongIds] }), at);
}

describe('daily practice 1.63', () => {
  it.each(['normal', 'adventure'] as const)('excludes all-credit and written questions from every new %s assignment', mode => {
    const excluded: Question[] = [
      { ...questions[0], id: 'all-credit', answerKey: { kind: 'all-credit' } },
      { ...questions[0], id: 'every-option', answerKey: { kind: 'accepted', options: [0, 1, 2, 3] } },
      { ...questions[0], id: 'written', answerKey: { kind: 'written' } },
    ];
    const session = createDailyPracticeSession([...excluded, ...questions], ['law'], '2026-10-16', () => 0, mode);
    expect(session.questionIds).not.toContain('all-credit');
    expect(session.questionIds).not.toContain('every-option');
    expect(session.questionIds).not.toContain('written');
    expect(session.questionIds).toHaveLength(mode === 'normal' ? 50 : 74);
    expect(createDailyPracticeSession(excluded, ['law']).questionIds).toEqual([]);
    expect(createDailyPracticeSession([...excluded, questions[0]], ['law'], undefined, undefined, mode).questionIds).toEqual([questions[0].id]);
    const legacy = { ...session, questionIds: ['all-credit', ...session.questionIds], answers: { 'all-credit': { selected: 0, correct: true } }, currentIndex: 1 };
    expect(parseDailyPracticeSession(JSON.stringify(legacy), legacy.date)?.questionIds[0]).toBe('all-credit');
    expect(parseDailyPracticeSession(JSON.stringify(legacy), legacy.date)?.answers['all-credit']).toEqual({ selected: 0, correct: true });
  });
  it('uses fixed boss HP, latest mistake caps, and unique single-subject reserves', () => {
    expect(DAILY_STAGES.map(s => s.questions)).toEqual([5, 6, 7, 8, 9, 15]);
    expect(DAILY_STAGES.map(s => s.wrongLimit)).toEqual([7, 6, 5, 4, 4, 3]);
    expect(DAILY_MAX_RUN_QUESTIONS).toBe(74);
    const bank = [...questions, ...questions.map(q => ({ ...q, id: 'env-' + q.id, subject: 'env' as const }))];
    const game = createDailyPracticeSession(bank, ['law', 'env']);
    expect(game.subjects).toEqual(['law']);
    expect(game.questionIds).toHaveLength(74);
    expect(new Set(game.questionIds).size).toBe(74);
    expect(game.questionIds.every(id => id.startsWith('law-'))).toBe(true);
    expect(run('normal').questionIds).toHaveLength(50);
  });
  it('only correct answers damage the boss, not attempts or review', () => {
    let session = answer(run(), false);
    expect(getDailyRunState(session)).toMatchObject({ stageIndex: 0, bossRemaining: 5 });
    session.reviewedWrongIds = [...session.unreviewedWrongIds];
    expect(getDailyCombatState(session).bossRemaining).toBe(5);
    session = next(session);
    for (let i = 0; i < 4; i++) session = next(answer(session, true));
    expect(session.status).toBe('practice');
    expect(getDailyRunState(session)).toMatchObject({ stageIndex: 0, bossRemaining: 1 });
    expect(finishDailyStageReview(session)).toBe(session);
    session = answer(session, true);
    expect(getDailyRunState(session).bossRemaining).toBe(0);
    expect(advanceDailyQuestion(session).status).toBe('review');
  });
  it.each(DAILY_STAGES.map((s, index) => [index, s.wrongLimit] as const))('fails at stage %i exact cap %i and persists defeat', (stageIndex, limit) => {
    let session = run();
    for (let stage = 0; stage < stageIndex; stage++) {
      for (let i = 0; i < DAILY_STAGES[stage].questions; i++) session = next(answer(session, true));
      session = review(session);
    }
    expect(getDailyRunState(session).stageIndex).toBe(stageIndex);
    for (let i = 0; i < limit; i++) {
      session = answer(session, false);
      if (i < limit - 1) session = next(session);
    }
    expect(session).toMatchObject({ status: 'failed', failureReason: 'mistakes', hp: 0 });
    expect(getDailyRunState(session).stageIndex).toBe(stageIndex);
    expect(getDailyRunState(session).bossRemaining).toBe(DAILY_STAGES[stageIndex].questions);
    expect(parseDailyPracticeSession(JSON.stringify(session), session.date)?.status).toBe('failed');
  });
  it('heals HP but never cancels mistakes; three correct award a relic', () => {
    let session = next(answer(run(), false));
    for (let i = 0; i < 3; i++) session = next(answer(session, true));
    expect(getDailyRunState(session).stages[0].wrong).toBe(1);
    expect(getDailyRunState(session).remaining).toBe(6);
    expect(session.hp).toBe(100);
    expect(getDailyRelicInventory(session.questionIds, session.answers)).toEqual({ eliminate: 1, barrier: 0 });
  });
  it('carries health through answers, paused explanations, stage reviews and stage changes', () => {
    let session = answer(run(), true, 51_000);
    expect(session.hp).toBe(90);
    expect(getDailyHealth(session, 999_000)).toBe(90);
    session = next(session, 60_000);
    expect(getDailyHealth(session, 80_000)).toBe(80);
    session = answer(session, true, 80_000);
    for (let i = 0; i < 3; i++) session = answer(next(session, 100_000 + i * 50_000), true, 150_000 + i * 50_000);
    expect(session.hp).toBe(65);
    session = advanceDailyQuestion(session);
    expect(session.status).toBe('review');
    expect(getDailyHealth(session, 999_000)).toBe(65);
    session = review(session, 1_000_000);
    expect(getDailyRunState(session).stageIndex).toBe(1);
    expect(session.hp).toBe(65);
    expect(getDailyHealth(session, 1_020_000)).toBe(55);
  });
  it.each([false, true])('requires 50 correct, including enough reserves for maximum survivable mistakes (%s)', maxMistakes => {
    let session = run();
    for (const stage of DAILY_STAGES) {
      for (let i = 0; i < (maxMistakes ? stage.wrongLimit - 1 : 1); i++) session = next(answer(session, false));
      for (let i = 0; i < stage.questions; i++) session = next(answer(session, true));
      expect(session.status).toBe('review');
      session = review(session);
    }
    expect(session.status).toBe('completed');
    expect(Object.keys(session.answers)).toHaveLength(maxMistakes ? 73 : 56);
    expect(getDailyRunState(session).totalCorrect).toBe(50);
    expect(getDailyCombatState(session).bossRemaining).toBe(0);
  });
  it('normal practice has no time, HP failure, or mistake cap and completes 50 attempts', () => {
    let session = run('normal');
    expect(session.questionDeadlineMs).toBeUndefined();
    session.hp = 0;
    for (let i = 0; i < 50; i++) session = advanceDailyQuestion(answer(session, false, 1e10));
    expect(session.status).toBe('completed');
    expect(Object.keys(session.answers)).toHaveLength(50);
    expect(getDailyCombatState(session).active).toBe(false);
  });
  it('prevents zero-HP revival, deadline-boundary answers and duplicate submissions', () => {
    expect(answer({ ...run(), hp: 5 }, true, 11_000)).toMatchObject({ status: 'failed', failureReason: 'health', hp: 0 });
    expect(answer(run(), true, 61_000)).toMatchObject({ status: 'failed', failureReason: 'time' });
    const answered = answer(run(), true);
    expect(answer(answered, true)).toBe(answered);
  });
  it('perfect guard pauses drain but not mistakes; it cannot be reused after reload', () => {
    let session = activateDailyGuard(run(), 7000);
    expect(session.guardUses?.[session.questionIds[0]]).toBe('perfect');
    expect(session.hp).toBe(97);
    expect(getDailyHealth(session, 9000)).toBe(97);
    session = answer(session, false, 9000);
    expect(session.hp).toBe(97);
    expect(getDailyRunState(session).stages[0].wrong).toBe(1);
    expect(session.protectedWrongIds).toHaveLength(1);
    session = next(session, 12_000);
    expect(getDailyCombatState(session, 12_000).guardAvailable).toBe(false);
    const restored = parseDailyPracticeSession(JSON.stringify(session), session.date)!;
    expect(activateDailyGuard(restored, 13_000)).toBe(restored);
  });
  it('early guard gives two seconds, no HP reset, and no damage immunity', () => {
    const session = activateDailyGuard(run(), 1000);
    expect(session.questionDeadlineMs).toBe(63_000);
    expect(session.guardUntilMs).toBeUndefined();
    expect(answer(session, false).hp).toBe(90);
  });
  it('settles previous drain before shield activation without retroactive protection', () => {
    const session = { ...settleDailyHealth(run(), 11_000), barrierUntilMs: 21_000 };
    expect(session.hp).toBe(95);
    expect(getDailyHealth(session, 21_000)).toBe(95);
    expect(getDailyHealth(session, 23_000)).toBe(94);
    expect(answer(session, false, 12_000).hp).toBe(95);
  });
  it('keeps a shield active across the next question for only its original wall-clock duration', () => {
    let session: DailyPracticeSession = { ...run(), barrierUntilMs: 11_000 };
    session = next(answer(session, true, 2000), 3000);
    expect(session.barrierUntilMs).toBe(11_000);
    expect(getDailyHealth(session, 11_000)).toBe(100);
    expect(getDailyHealth(session, 13_000)).toBe(99);
    expect(startDailyQuestion(session, 13_000).barrierUntilMs).toBeUndefined();
  });
  it('renews the guard by actual defeated boss, not attempted-question position', () => {
    let session = activateDailyGuard(run(), 1000);
    session = next(answer(session, false));
    for (let i = 0; i < 4; i++) session = next(answer(session, true));
    expect(session.currentIndex).toBe(5);
    expect(getDailyCombatState(session, 1000).guardAvailable).toBe(false);
    session = review(next(answer(session, true)));
    expect(session.currentIndex).toBe(6);
    expect(getDailyCombatState(session, 1000).guardAvailable).toBe(true);
  });
  it('sanitizes malformed HP and duplicate stage guard entries on restore', () => {
    const session = next(answer(activateDailyGuard(run(), 1000), true));
    session.guardUses![session.questionIds[1]] = 'perfect';
    session.guardUses!.unknown = 'perfect';
    session.hp = 500;
    const restored = parseDailyPracticeSession(JSON.stringify(session), session.date)!;
    expect(restored.hp).toBe(100);
    expect(Object.keys(restored.guardUses!)).toEqual([session.questionIds[0]]);
  });
  it('even shield-protected mistakes reach the exact defeat cap', () => {
    let session = run();
    for (let i = 0; i < 7; i++) {
      session.barrierUntilMs = 2000;
      session = answer(session, false);
      if (i < 6) session = next(session);
    }
    expect(session).toMatchObject({ status: 'failed', failureReason: 'mistakes' });
  });
  it('pauses loading without replenishing HP or the remaining deadline', () => {
    const paused = pauseDailyQuestion(run(), 21_000);
    expect(paused.hp).toBe(90);
    expect(paused.questionRemainingMs).toBe(40_000);
    expect(getDailyHealth(paused, 500_000)).toBe(90);
    const resumed = startDailyQuestion(paused, 500_000);
    expect(resumed.questionDeadlineMs).toBe(540_000);
    expect(getDailyHealth(resumed, 510_000)).toBe(85);
  });
  it('restores all 74 reserves, mode, HP, and never resurrects a defeated run', () => {
    const session = run();
    const restored = parseDailyPracticeSession(JSON.stringify(session), session.date)!;
    expect(restored.questionIds).toHaveLength(74);
    expect(restored).toMatchObject({ mode: 'adventure', rulesVersion: 3, hp: 100 });
    session.status = 'failed'; session.failureReason = 'health'; session.hp = 0;
    expect(parseDailyPracticeSession(JSON.stringify(session), session.date)?.status).toBe('failed');
    expect(parseDailyPracticeSession(JSON.stringify({ ...run(), status: 'completed', currentIndex: 74 }), session.date))
      .toMatchObject({ status: 'failed', failureReason: 'questions' });
  });
  it('preserves legacy progress in normal mode and does not delete its answers', () => {
    const session = answer(run(), false);
    delete session.rulesVersion; delete session.mode;
    const restored = parseDailyPracticeSession(JSON.stringify(session), session.date)!;
    expect(restored).toMatchObject({ mode: 'normal', migrated: true });
    expect(restored.answers).toEqual(session.answers);
    expect(restored.questionDeadlineMs).toBeUndefined();
  });
  it('ends insufficient reserves without declaring a living boss defeated', () => {
    const session = answer(startDailyQuestion(createDailyPracticeSession(questions.slice(0, 1), ['law']), 1000), true);
    expect(advanceDailyQuestion(session)).toMatchObject({ status: 'failed', failureReason: 'questions' });
    expect(getDailyCombatState(advanceDailyQuestion(session)).bossRemaining).toBe(4);
  });
  it('selects subject-specific bosses and retains construction and structure fallback', () => {
    expect(getDailyStageTheme('law', 5)).toMatchObject({ boss: '技規法典龍', sprite: '/daily-game/law-boss-6-v5.webp', facing: 1 });
    expect(getDailyStageTheme('env', 0)).toMatchObject({ boss: '旋風精靈', skill: '旋風衝擊' });
    expect(getDailyStageTheme('construction', 0).boss).toBe('砌縫咕嚕');
    expect(getDailyStageTheme('structure', 5).boss).toBe('天際龍王');
  });
  it('uses neutral journey names for every law and environmental stage without changing its rules', () => {
    for (const subject of ['law', 'env'] as const) {
      expect(DAILY_STAGES.map((_, index) => getDailyStageTheme(subject, index).name))
        .toEqual(['入口', '迴廊', '階梯', '露臺', '高臺', '塔頂']);
      for (const [index, stage] of DAILY_STAGES.entries()) {
        expect(getDailyStageTheme(subject, index)).toMatchObject({ questions: stage.questions, wrongLimit: stage.wrongLimit });
      }
    }
    expect(getDailyStageTheme('structure', 0).sprite).toBe('/daily-game/construction-boss-1-v5.webp');
  });
  it('keeps option-answer mappings and rejects malformed orders', () => {
    expect(applyDailyOptionOrder(questions[0], [2, 0, 3, 1]).answerKey).toEqual({ kind: 'accepted', options: [1] });
    expect(applyDailyOptionOrder(questions[0], [0, 0, 1, 2])).toBe(questions[0]);
  });
  it('preserves extended completion results and expires only at Taipei midnight', () => {
    const result = createDailyCompletionResult(Object.fromEntries(Array.from({ length: 56 }, (_, i) => [String(i), { selected: 0, correct: i < 50 }])), 'completed');
    expect(result).toEqual({ answered: 56, correct: 50, status: 'completed' });
    const record = JSON.stringify({ date: '2026-10-11', subjects: ['law'], results: { law: result } });
    expect(parseDailyCompletionRecord(record, '2026-10-11').results.law).toEqual(result);
    expect(parseDailyCompletionRecord(record, '2026-10-12').subjects).toEqual([]);
    expect(getMillisecondsUntilTaipeiMidnight(new Date('2026-10-11T15:59:00Z'))).toBe(60_000);
    expect(getTaipeiDateKey(new Date('2026-10-11T16:01:00Z'))).toBe('2026-10-12');
    expect(getDailyRemainingTimeMs(38000, 18000)).toBe(20000);
  });
  it('rejects corrupt, stale and multi-subject sessions', () => {
    expect(parseDailyPracticeSession('{broken')).toBeNull();
    expect(parseDailyPracticeSession(JSON.stringify(run()), '2026-10-12')).toBeNull();
    expect(parseDailyPracticeSession(JSON.stringify({ ...run(), subjects: ['law', 'env'] }), '2026-10-11')).toBeNull();
  });
});
