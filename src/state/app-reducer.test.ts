import { describe, expect, it } from 'vitest';
import { createDefaultState } from '@/lib/study';
import type { HistoryEntry } from '@/lib/types';
import { appReducer } from '@/state/app-reducer';

function entry(id: string, questionId = 1): HistoryEntry {
  return {
    id,
    questionId,
    selected: 1,
    correct: true,
    answeredAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('appReducer', () => {
  it('does not add the same attempt twice', () => {
    const first = appReducer(createDefaultState(), {
      type: 'record-answer',
      entry: entry('attempt-1'),
    });
    const duplicate = appReducer(first, {
      type: 'record-answer',
      entry: entry('attempt-1'),
    });
    expect(duplicate.history).toHaveLength(1);
  });

  it('keeps only the newest 100 history entries', () => {
    let state = createDefaultState();
    for (let index = 0; index < 105; index += 1) {
      state = appReducer(state, {
        type: 'record-answer',
        entry: entry(`attempt-${index}`, (index % 20) + 1),
      });
    }
    expect(state.history).toHaveLength(100);
    expect(state.history[0].id).toBe('attempt-104');
    expect(state.history.at(-1)?.id).toBe('attempt-5');
  });

  it('toggles difficult questions and resets all preferences', () => {
    let state = appReducer(createDefaultState(), {
      type: 'toggle-difficult',
      questionId: 7,
    });
    state = appReducer(state, {
      type: 'update-preferences',
      preferences: { theme: 'dark', sidebarCollapsed: true },
    });
    expect(state.difficultQuestionIds).toEqual([7]);
    expect(state.preferences.theme).toBe('dark');
    expect(appReducer(state, { type: 'reset' })).toEqual(createDefaultState());
  });
});
