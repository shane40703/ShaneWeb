import { firestoreErrorCode } from '@/lib/firestore-error-code';

/** Rules, account or setup problems (a missing index among them): subscribing again on a timer cannot fix them. */
const PERMANENT_LISTEN_ERRORS = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
  'not-found',
]);

export interface ListenRetry {
  /** The first wait, doubled after each further failure in a row. */
  base: number;
  /** The first wait while over the Firestore quota, which lifts only at the daily reset. */
  quota?: number;
  max: number;
}

/**
 * How long to wait before subscribing again after a listener failed with `cause`, when
 * `failures` listeners failed in a row before it. Null for a failure no timer can fix: those
 * wait for going online, a reload or whatever else the caller offers.
 */
export function listenRetryDelay(
  cause: unknown,
  failures: number,
  { base, quota = base, max }: ListenRetry,
) {
  const code = firestoreErrorCode(cause);
  if (PERMANENT_LISTEN_ERRORS.has(code)) return null;
  return Math.min(max, (code === 'resource-exhausted' ? quota : base) * 2 ** failures);
}
