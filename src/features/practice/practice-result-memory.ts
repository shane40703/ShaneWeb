import {
  hasPracticeAnswers,
  type PracticeResult,
  type PracticeSession,
} from './practice-session';

// Module state lives as long as the tab's app does: leaving for the hub and coming back
// still shows a submitted result, while a reload drops it as before.
let kept: PracticeResult | null = null;

export function keepPracticeResult(result: PracticeResult | null) {
  kept = result;
}

/** The kept result of this set, unless the set has been answered again since. */
export function readKeptPracticeResult(session: PracticeSession | null) {
  return session && kept?.session.id === session.id && !hasPracticeAnswers(session)
    ? kept
    : null;
}
