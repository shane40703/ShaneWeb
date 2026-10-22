import { describe, expect, it } from 'vitest';
import {
  CLOZE_STORAGE_KEY,
  clozeBank,
  createClozeSession,
  parseClozeSession,
  serializeClozeSession,
  summarizeClozeRound,
} from './cloze';
import {
  CLOZE_STORAGE_KEY as PROGRESS_STORAGE_KEY,
  parseClozeRoundProgress,
} from './cloze-progress';

function answersFor(id: string, right: boolean) {
  return clozeBank.questions
    .find((question) => question.id === id)!
    .blanks.map((blank) => (right ? blank.answer : '999999'));
}

describe('law cloze round progress', () => {
  it('saves the round with the figures the practice hub reads back', () => {
    const round = createClozeSession({ count: 5 });
    const session = {
      ...round,
      index: 2,
      results: {
        [round.order[0]]: answersFor(round.order[0], true),
        [round.order[1]]: answersFor(round.order[1], false),
      },
      revealed: [round.order[2]],
    };

    const saved = serializeClozeSession(session);
    expect(parseClozeRoundProgress(saved)).toEqual({
      total: 5,
      submitted: 2,
      correct: 1,
      revealed: 1,
      complete: false,
    });
    // The page itself restores the same round and ignores the extra figures.
    expect(parseClozeSession(saved)).toEqual(session);
  });

  it('counts the round complete once its last question is graded or revealed', () => {
    const round = createClozeSession({ count: 5 });
    const last = round.order[4];
    expect(summarizeClozeRound({ ...round, index: 4 }).complete).toBe(false);
    expect(
      summarizeClozeRound({
        ...round,
        index: 4,
        submitted: true,
        answers: answersFor(last, true),
        results: { [last]: answersFor(last, true) },
      }).complete,
    ).toBe(true);
    expect(summarizeClozeRound({ ...round, index: 4, revealed: [last] }).complete).toBe(
      true,
    );
  });

  it('reads nothing from a missing, damaged or inconsistent record', () => {
    const progress = { total: 5, submitted: 2, correct: 1, revealed: 1, complete: false };
    expect(parseClozeRoundProgress(null)).toBeNull();
    expect(parseClozeRoundProgress('{')).toBeNull();
    expect(parseClozeRoundProgress(JSON.stringify(createClozeSession()))).toBeNull();
    expect(
      parseClozeRoundProgress(JSON.stringify({ progress: { ...progress, correct: 3 } })),
    ).toBeNull();
    expect(
      parseClozeRoundProgress(JSON.stringify({ progress: { ...progress, revealed: 4 } })),
    ).toBeNull();
    expect(
      parseClozeRoundProgress(JSON.stringify({ progress: { ...progress, total: 0 } })),
    ).toBeNull();
    expect(parseClozeRoundProgress(JSON.stringify({ progress }))).toEqual(progress);
  });

  it('keeps one storage key for the page and the hub', () => {
    expect(CLOZE_STORAGE_KEY).toBe('shaneweb:law-cloze');
    expect(PROGRESS_STORAGE_KEY).toBe(CLOZE_STORAGE_KEY);
  });
});
