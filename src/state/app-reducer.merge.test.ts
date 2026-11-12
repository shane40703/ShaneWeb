import { describe, expect, it } from 'vitest';
import { createDefaultState } from '@/lib/study';
import type { QuizAttempt } from '@/lib/types';
import { appReducer } from '@/state/app-reducer';

function attempt(id: string, submittedAt: string): QuizAttempt {
  return {
    id,
    mode: 'paper',
    subject: 'law',
    year: 114,
    questionIds: ['law-114-01', 'law-114-02'],
    answers: { 'law-114-01': 1, 'law-114-02': 3 },
    startedAt: '2026-11-12T00:00:00.000Z',
    submittedAt,
    elapsedSeconds: 60,
    correctCount: 1,
    wrongCount: 1,
    unansweredCount: 0,
  };
}

/** The same values with every map's keys in another order, as Firestore returns them. */
function reordered<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reordered) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reordered(item)]),
  ) as T;
}

describe('appReducer merges from the cloud', () => {
  const older = attempt('attempt-older', '2026-11-11T00:00:00.000Z');
  const newer = attempt('attempt-newer', '2026-11-12T00:00:00.000Z');
  const state = { ...createDefaultState(), attempts: [newer, older] };

  it('keeps the same state when the cloud only repeats known attempts', () => {
    expect(appReducer(state, { type: 'merge-attempts', attempts: [] })).toBe(state);
    expect(
      appReducer(state, {
        type: 'merge-attempts',
        attempts: [{ ...older }, { ...newer }],
      }),
    ).toBe(state);
    const echo = reordered(older);
    expect(Object.keys(echo)).not.toEqual(Object.keys(older));
    expect(appReducer(state, { type: 'merge-attempts', attempts: [echo] })).toBe(state);
  });

  it('ignores a deleted attempt and still merges real changes newest first', () => {
    const deleted = attempt('attempt-deleted', '2026-11-13T00:00:00.000Z');
    const withTombstone = { ...state, deletedAttemptIds: [deleted.id] };
    expect(
      appReducer(withTombstone, { type: 'merge-attempts', attempts: [deleted] }),
    ).toBe(withTombstone);

    const latest = attempt('attempt-latest', '2026-11-13T00:00:00.000Z');
    const added = appReducer(state, {
      type: 'merge-attempts',
      attempts: [older, latest],
    });
    expect(added).not.toBe(state);
    expect(added.attempts.map((item) => item.id)).toEqual([
      'attempt-latest',
      'attempt-newer',
      'attempt-older',
    ]);

    const corrected = { ...older, correctCount: 2, wrongCount: 0 };
    const changed = appReducer(state, { type: 'merge-attempts', attempts: [corrected] });
    expect(changed).not.toBe(state);
    expect(changed.attempts.find((item) => item.id === older.id)).toEqual(corrected);

    const answerChanged = {
      ...older,
      answers: { 'law-114-02': 3, 'law-114-01': 2 },
    };
    expect(
      appReducer(state, { type: 'merge-attempts', attempts: [answerChanged] }),
    ).not.toBe(state);
  });

  it('keeps the same state when no cloud note is newer than the local one', () => {
    const local = {
      ...createDefaultState(),
      notes: { 'law-114-01': '本機筆記' },
      noteUpdatedAt: { 'law-114-01': '2026-11-12T00:00:00.000Z' },
    };
    expect(appReducer(local, { type: 'merge-notes', notes: [] })).toBe(local);
    expect(
      appReducer(local, {
        type: 'merge-notes',
        notes: [
          {
            questionId: 'law-114-01',
            content: '本機筆記',
            updatedAt: '2026-11-12T00:00:00.000Z',
          },
          {
            questionId: 'law-114-01',
            content: '舊版',
            updatedAt: '2026-11-01T00:00:00.000Z',
          },
        ],
      }),
    ).toBe(local);

    const merged = appReducer(local, {
      type: 'merge-notes',
      notes: [
        {
          questionId: 'law-114-01',
          content: '雲端新版',
          updatedAt: '2026-11-13T00:00:00.000Z',
        },
      ],
    });
    expect(merged).not.toBe(local);
    expect(merged.notes['law-114-01']).toBe('雲端新版');
    expect(merged.noteUpdatedAt['law-114-01']).toBe('2026-11-13T00:00:00.000Z');
  });
});
