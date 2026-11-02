import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '@/lib/study';
import { AppStateProvider, useAppState } from './app-state';

const writes = vi.hoisted(() => ({
  pending: [] as Array<{ resolve: () => void; reject: () => void }>,
}));

vi.mock('@/lib/note-image-storage', () => ({
  readStoredNoteImages: async () => null,
  writeStoredNoteImages: () => new Promise<void>((resolve, reject) => {
    writes.pending.push({ resolve, reject: () => reject(new Error('image write failed')) });
  }),
  stateWithoutNoteImages: (state: object) => ({ ...state, noteImages: {} }),
}));

function Probe() {
  const { hydrated, dispatch } = useAppState();
  return <button disabled={!hydrated} onClick={() => dispatch({
    type: 'toggle-difficult', questionId: 'law-114-01',
  })}>toggle</button>;
}

describe('app-state persistence ordering', () => {
  beforeEach(() => {
    localStorage.clear();
    writes.pending = [];
  });
  afterEach(cleanup);

  it.each(['resolve', 'reject'] as const)(
    'does not let an older image write %s overwrite a newer difficult mark',
    async (finishOld) => {
      render(<AppStateProvider><Probe /></AppStateProvider>);
      await waitFor(() => expect(writes.pending).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
      await waitFor(() => expect(writes.pending).toHaveLength(2));
      await act(async () => writes.pending[1].resolve());
      await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).difficultQuestionIds)
        .toEqual(['law-114-01']));
      await act(async () => writes.pending[0][finishOld]());
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.difficultQuestionIds).toEqual(['law-114-01']);
      expect(saved.difficultPendingChanges).toEqual({ 'law-114-01': true });
    },
  );
});
