import { describe, expect, it } from 'vitest';
import { createDefaultState } from '@/lib/study';
import { stateWithoutNoteImages } from '@/lib/note-image-storage';

describe('note image persistence', () => {
  it('removes large note images from the localStorage state without mutating memory', () => {
    const state = createDefaultState();
    state.noteImages['law-114-01'] = [{
      id: 'image-1',
      name: 'note.png',
      type: 'image/png',
      dataUrl: 'data:image/png;base64,large-image',
    }];

    const compact = stateWithoutNoteImages(state);

    expect(compact.noteImages).toEqual({});
    expect(state.noteImages['law-114-01']).toHaveLength(1);
    expect(compact.attempts).toBe(state.attempts);
  });
});
