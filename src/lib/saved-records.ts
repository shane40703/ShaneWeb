import type { AppState } from '@/lib/types';

/** One record is an attempt, a 難題 mark or a noted question; a note of images alone is one too. */
export function countSavedRecords(
  state: Pick<AppState, 'attempts' | 'notes' | 'noteImages' | 'difficultQuestionIds'>,
) {
  const noteIds = new Set([
    ...Object.keys(state.notes).filter((id) => state.notes[id].trim()),
    ...Object.keys(state.noteImages).filter((id) => state.noteImages[id].length),
  ]);
  return state.attempts.length + noteIds.size + state.difficultQuestionIds.length;
}
