/** Kept apart from the bank, so the practice hub can read the saved round without it. */
export const CLOZE_STORAGE_KEY = 'shaneweb:law-cloze';

/** The figures the practice hub shows of a round, saved with it by the cloze page. */
export interface ClozeRoundProgress {
  total: number;
  /** Graded questions. */
  submitted: number;
  /** Graded questions with every blank right. */
  correct: number;
  /** Questions read with their answers shown, which are never graded. */
  revealed: number;
  complete: boolean;
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** The saved round's figures; null when there is no round or it was saved without them. */
export function parseClozeRoundProgress(raw: string | null): ClozeRoundProgress | null {
  let progress: Partial<Record<keyof ClozeRoundProgress, unknown>> | undefined;
  try {
    progress = (JSON.parse(raw ?? 'null') as { progress?: typeof progress } | null)
      ?.progress;
  } catch {
    return null;
  }
  if (!progress || typeof progress !== 'object') return null;
  const { total, submitted, correct, revealed, complete } = progress;
  if (
    !isCount(total) ||
    !total ||
    !isCount(submitted) ||
    !isCount(correct) ||
    !isCount(revealed) ||
    typeof complete !== 'boolean' ||
    correct > submitted ||
    submitted + revealed > total
  ) {
    return null;
  }
  return { total, submitted, correct, revealed, complete };
}
