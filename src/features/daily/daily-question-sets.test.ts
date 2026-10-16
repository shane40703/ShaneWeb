import { describe, expect, it, vi } from 'vitest';
import type { Question } from '@/lib/types';
import { createDailyPracticeSession, getTaipeiDateKey } from './daily-practice';
import { getDailyNormalSession, parseDailyQuestionSets, rememberDailyNormalSet } from './daily-question-sets';

const date = '2026-10-16';
const questions: Question[] = (['law', 'env', 'construction', 'structure'] as const).flatMap(subject =>
  Array.from({ length: 90 }, (_, index) => ({
    id: `${subject}-${index}`, subject, year: 114, questionNumber: index + 1,
    topic: '測試', primaryCategory: '測試', tags: [], text: '題目', content: [{ kind: 'text' as const, text: '題目' }],
    options: ['A', 'B', 'C', 'D'], answerKey: { kind: 'accepted' as const, options: [0] }, source: { kind: 'sample' as const },
  })),
);

describe('one daily normal assignment per subject', () => {
  it('draws once, then retains question and option order without calling random again', () => {
    const random = vi.fn(() => .3);
    const first = getDailyNormalSession({ date, sets: {} }, questions, 'law', date, random);
    expect(first.session.questionIds).toHaveLength(50);
    random.mockClear();
    const replay = getDailyNormalSession(first.record, questions, 'law', date, random);
    expect(random).not.toHaveBeenCalled();
    expect(replay.session).toEqual(first.session);
    // Answering or mutating a replay must not contaminate the saved assignment.
    replay.session.answers[replay.session.questionIds[0]] = { selected: 2, correct: false };
    replay.session.optionOrders[replay.session.questionIds[0]].reverse();
    expect(getDailyNormalSession(first.record, questions, 'law', date, random).session).toEqual(first.session);
  });

  it('persists all four subjects independently through serialization and subject switching', () => {
    let record = parseDailyQuestionSets(null, date);
    for (const subject of ['law', 'env', 'construction', 'structure'] as const) {
      const next = getDailyNormalSession(record, questions, subject, date, () => .4);
      record = next.record;
      expect(next.session.questionIds.every(id => id.startsWith(subject))).toBe(true);
    }
    const restored = parseDailyQuestionSets(JSON.stringify(record), date);
    expect(restored).toEqual(record);
    expect(Object.keys(restored.sets)).toHaveLength(4);
    const random = vi.fn(() => .9);
    expect(getDailyNormalSession(restored, questions, 'law', date, random).session).toEqual(record.sets.law);
    expect(random).not.toHaveBeenCalled();
  });

  it('expires all subjects on the next Taipei day and allows a new draw', () => {
    const first = getDailyNormalSession({ date, sets: {} }, questions, 'law', date, () => 0);
    const nextDate = getTaipeiDateKey(new Date('2026-10-16T16:00:00Z'));
    expect(nextDate).toBe('2026-10-17');
    expect(parseDailyQuestionSets(JSON.stringify(first.record), nextDate).sets).toEqual({});
    const random = vi.fn(() => .9);
    const next = getDailyNormalSession(first.record, questions, 'law', nextDate, random);
    expect(random).toHaveBeenCalled();
    expect(next.record.date).toBe(nextDate);
    expect(next.session.questionIds).not.toEqual(first.session.questionIds);
  });

  it('migrates a legacy paper without redrawing, and never stores answers or run state', () => {
    const active = createDailyPracticeSession(questions, ['law'], date, () => .2, 'normal');
    active.answers[active.questionIds[0]] = { selected: 1, correct: false };
    active.currentIndex = 1;
    active.status = 'completed';
    active.eliminatedOptions[active.questionIds[0]] = [3];
    active.hp = 5;
    const original = JSON.stringify(active);
    const restored = parseDailyQuestionSets(original, date);
    expect(restored.sets.law).toMatchObject({
      questionIds: active.questionIds, optionOrders: active.optionOrders,
      answers: {}, currentIndex: 0, status: 'practice', eliminatedOptions: {}, hp: 100,
    });
    expect(JSON.stringify(active)).toBe(original);
    expect(rememberDailyNormalSet({ date, sets: {} }, active)).toEqual(restored);
  });

  it('never caches adventure assignments, including a legacy paper-mode game', () => {
    const game = createDailyPracticeSession(questions, ['law'], date, () => .2, 'adventure');
    expect(rememberDailyNormalSet({ date, sets: {} }, game).sets).toEqual({});
    expect(parseDailyQuestionSets(JSON.stringify(game), date).sets).toEqual({});
    expect(parseDailyQuestionSets(JSON.stringify({ date, sets: { law: game } }), date).sets).toEqual({});
  });

  it.each([null, '', 'broken', 'null', '[]', '{}', JSON.stringify({ date, sets: [] }), JSON.stringify({ date, sets: { law: null, fake: {} } })])(
    'safely ignores malformed cache %s', raw => {
      expect(parseDailyQuestionSets(raw, date)).toEqual({ date, sets: {} });
    },
  );

  it('rejects mismatched subject slots without discarding other valid subjects', () => {
    const law = createDailyPracticeSession(questions, ['law'], date, () => .5, 'normal');
    expect(parseDailyQuestionSets(JSON.stringify({ date, sets: { law, env: law } }), date).sets).toEqual({ law });
  });

  it('does not lock in an empty assignment when questions are unavailable', () => {
    const empty = getDailyNormalSession({ date, sets: {} }, [], 'law', date);
    expect(empty.record.sets).toEqual({});
    expect(getDailyNormalSession(empty.record, questions, 'law', date).session.questionIds).toHaveLength(50);
  });

  it('never silently redraws a saved assignment after a question-bank change', () => {
    const first = getDailyNormalSession({ date, sets: {} }, questions, 'law', date);
    const random = vi.fn();
    expect(getDailyNormalSession(first.record, [], 'law', date, random).session).toEqual(first.session);
    expect(random).not.toHaveBeenCalled();
  });
});
