import { describe, expect, it } from 'vitest';
import { listenRetryDelay } from './listen-retry';

const MINUTE = 60_000;
const options = { base: MINUTE, quota: 5 * MINUTE, max: 30 * MINUTE };

describe('listener re-subscribe wait', () => {
  it('doubles from the base up to the cap, from the quota base while over quota', () => {
    const waits = (code: string) =>
      [0, 1, 2, 3, 4, 5, 6].map(
        (failures) => listenRetryDelay({ code }, failures, options)! / MINUTE,
      );
    expect(waits('unavailable')).toEqual([1, 2, 4, 8, 16, 30, 30]);
    expect(waits('resource-exhausted')).toEqual([5, 10, 20, 30, 30, 30, 30]);
    // Without a quota base, being over quota waits like any other passing failure.
    expect(
      listenRetryDelay({ code: 'resource-exhausted' }, 0, {
        base: 30_000,
        max: 30 * MINUTE,
      }),
    ).toBe(30_000);
    expect(listenRetryDelay(new Error('no code'), 1, options)).toBe(2 * MINUTE);
    expect(listenRetryDelay(undefined, 0, options)).toBe(MINUTE);
  });
  it('gives no wait for rules, account, index or setup problems, with or without the firestore/ prefix', () => {
    for (const code of [
      'permission-denied',
      'unauthenticated',
      'invalid-argument',
      'failed-precondition',
      'not-found',
    ]) {
      expect(listenRetryDelay({ code }, 0, options)).toBeNull();
      expect(listenRetryDelay({ code: `firestore/${code}` }, 3, options)).toBeNull();
    }
  });
});
