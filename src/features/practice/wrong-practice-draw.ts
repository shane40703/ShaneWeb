import type { SubjectId } from '@/lib/types';
import { drawWrongQuestions } from './wrong-weighted-draw';

export const WRONG_DRAW_HISTORY_KEY = 'shaneweb:wrong-practice-draws:v1';
const CYCLE_LENGTH = 5;
const MAX_IDS_PER_DRAW = 5000;
const MAX_HISTORY_BYTES = 1_000_000;
const subjects: SubjectId[] = ['law', 'env', 'construction', 'structure'];
type DrawHistory = Partial<Record<SubjectId, string[][]>>;

function parseHistory(raw: string | null): DrawHistory {
  if (!raw || raw.length > MAX_HISTORY_BYTES) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: DrawHistory = {};
    for (const subject of subjects) {
      const draws = (value as Record<string, unknown>)[subject];
      if (!Array.isArray(draws) || draws.length > CYCLE_LENGTH) continue;
      if (!draws.every((draw) => Array.isArray(draw) && draw.length > 0 && draw.length <= MAX_IDS_PER_DRAW &&
        draw.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 120) && new Set(draw).size === draw.length)) continue;
      result[subject] = draws;
    }
    return result;
  } catch {
    return {};
  }
}

/** Independent per-subject history, local to the browser like default daily draws. */
export function createWrongPracticeDrawStore() {
  let memory: DrawHistory = {};
  let useMemory = false;

  function read() {
    if (useMemory) return memory;
    try {
      memory = parseHistory(window.localStorage.getItem(WRONG_DRAW_HISTORY_KEY));
    } catch {
      useMemory = true;
    }
    return memory;
  }

  function write(value: DrawHistory) {
    memory = value;
    try {
      window.localStorage.setItem(WRONG_DRAW_HISTORY_KEY, JSON.stringify(value));
      useMemory = false;
    } catch {
      useMemory = true;
    }
  }

  return {
    /** Prefer unseen questions; if there are not enough, weight the previously seen remainder too. */
    choose<T extends { id: string }>(subject: SubjectId, candidates: readonly T[], wrongCounts: Readonly<Record<string, number>>, count: number, random: () => number = Math.random) {
      const previous = read()[subject] ?? [];
      const seen = new Set(previous.length < CYCLE_LENGTH ? previous.flat() : []);
      const fresh = candidates.filter((question) => !seen.has(question.id));
      const picked = drawWrongQuestions(fresh, wrongCounts, count, random);
      if (picked.length < count) {
        picked.push(...drawWrongQuestions(candidates.filter((question) => seen.has(question.id)), wrongCounts, count - picked.length, random));
      }
      return picked;
    },

    /** A draw enters the cycle only after the practice page is opened successfully. */
    record(subject: SubjectId, ids: readonly string[]) {
      if (!ids.length || ids.length > MAX_IDS_PER_DRAW) return;
      const history = read();
      const previous = history[subject] ?? [];
      write({ ...history, [subject]: [...(previous.length < CYCLE_LENGTH ? previous : []), [...ids]] });
    },
  };
}
