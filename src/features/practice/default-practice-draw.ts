import { pickRandomItems } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';

export const DEFAULT_DRAW_HISTORY_KEY = 'shaneweb:default-practice-draws:v1';
const CYCLE_LENGTH = 5;
const MAX_DEFAULT_DRAW = 50;
const subjects: SubjectId[] = ['law', 'env', 'construction', 'structure'];
type DrawHistory = Partial<Record<SubjectId, string[][]>>;

/** Reject broken or unexpectedly large data rather than letting it affect a new set. */
function parseHistory(raw: string | null): DrawHistory {
  if (!raw || raw.length > 100_000) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: DrawHistory = {};
    for (const subject of subjects) {
      const value = (parsed as Record<string, unknown>)[subject];
      if (!Array.isArray(value) || value.length > CYCLE_LENGTH) continue;
      if (!value.every((draw) => Array.isArray(draw) && draw.length > 0 && draw.length <= MAX_DEFAULT_DRAW &&
        draw.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 120) && new Set(draw).size === draw.length)) continue;
      result[subject] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Draw history is local to this browser. A blocked store still works for this page session. */
export function createDefaultPracticeDrawStore() {
  let memory: DrawHistory = {};
  let useMemory = false;

  function read(): DrawHistory {
    if (useMemory) return memory;
    try {
      memory = parseHistory(window.localStorage.getItem(DEFAULT_DRAW_HISTORY_KEY));
    } catch {
      useMemory = true;
    }
    return memory;
  }

  function write(value: DrawHistory) {
    memory = value;
    try {
      window.localStorage.setItem(DEFAULT_DRAW_HISTORY_KEY, JSON.stringify(value));
      useMemory = false;
    } catch {
      useMemory = true;
    }
  }

  return {
    /** Prefer unseen questions, then fill from the pool if five full sets are impossible. */
    choose<T extends Pick<Question, 'id'>>(
      subject: SubjectId,
      candidates: readonly T[],
      count: number,
      random: () => number = Math.random,
    ): T[] {
      const previous = read()[subject] ?? [];
      const seen = new Set(previous.length < CYCLE_LENGTH ? previous.flat() : []);
      const fresh = candidates.filter((item) => !seen.has(item.id));
      const picked = pickRandomItems(fresh, count, random);
      if (picked.length < count) {
        picked.push(...pickRandomItems(candidates.filter((item) => seen.has(item.id)), count - picked.length, random));
      }
      return picked;
    },

    /** Only successful default draws advance their own subject's five-draw cycle. */
    record(subject: SubjectId, ids: readonly string[]) {
      if (!ids.length) return;
      const history = read();
      const previous = history[subject] ?? [];
      write({ ...history, [subject]: [...(previous.length < CYCLE_LENGTH ? previous : []), [...ids]] });
    },
  };
}
