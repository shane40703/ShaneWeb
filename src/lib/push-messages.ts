/** Plain-text announcements. Document identity + stage is the deduplication boundary. */
export type PushStatus = 'test' | 'live';
export interface PushMessage {
  id: string;
  status: PushStatus;
  message: string;
  expiresAt: number;
}
export interface PushReceipt extends PushMessage {
  read: boolean;
  pending: boolean;
  /** Failed reports in a row, and the time (ms) before which it must not reach Firestore. */
  failures?: number;
  retryAt?: number;
  /** Whether the last failure was a lost or timed-out connection; going online hurries only those. */
  network?: boolean;
}
export const PUSH_MODE_KEY = 'shaneweb:push-test';
export const PUSH_BROWSER_KEY = 'shaneweb:push-browser';
export const PUSH_RECEIPT_PREFIX = 'shaneweb:push-receipt:';
/** Begins every key above; other tabs save answers under other keys all the time. */
export const PUSH_KEY_PREFIX = 'shaneweb:push-';
// Rules or data problems: an early retry cannot fix them, and a denied try still costs reads.
// Not 'failed-precondition': a transaction ends with it, as with 'aborted', when other visitors'
// commits kept outdating its reads of the shared stats, and that passes in minutes.
const PERMANENT_FAILURES = new Set(['permission-denied', 'invalid-argument', 'not-found', 'unauthenticated']);
// A lost or timed-out connection, or an error without a code: reconnecting is what fixes these.
// Contention on the shared stats and an exhausted quota are not, and wait out their time.
const NETWORK_FAILURES = new Set(['unavailable', 'deadline-exceeded', '']);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const memory = new Map<string, string>();

function get(key: string) {
  try { return memory.get(key) ?? localStorage.getItem(key); }
  catch { return memory.get(key) ?? null; }
}
function set(key: string, value: string) {
  try { localStorage.setItem(key, value); memory.delete(key); }
  catch { memory.set(key, value); /* Session-only in private/full storage. */ }
}
export function pushTestMode(search: string): boolean {
  const choice = new URLSearchParams(search).get('push_test');
  if (choice === '1' || choice === '0') set(PUSH_MODE_KEY, choice);
  return get(PUSH_MODE_KEY) === '1';
}
export function pushBrowserId() {
  let id = get(PUSH_BROWSER_KEY);
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    set(PUSH_BROWSER_KEY, id);
  }
  return id;
}
export function pushKey(message: Pick<PushMessage, 'id' | 'status'>) {
  return `${message.status}:${message.id}`;
}
export function parsePushMessage(id: string, data: Record<string, unknown>, now = Date.now()): PushMessage | null {
  if (data.status !== 'test' && data.status !== 'live') return null;
  if (typeof data.message !== 'string' || !data.message.trim() || data.message.length > 2000) return null;
  const timestamp = data.expiresAt as { toMillis?: () => number } | undefined;
  if (!timestamp || typeof timestamp.toMillis !== 'function') return null;
  const expiresAt = timestamp.toMillis();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { id, status: data.status, message: data.message.trim(), expiresAt };
}
export function getPushReceipt(message: Pick<PushMessage, 'id' | 'status'>): PushReceipt | null {
  try {
    const value = JSON.parse(get(PUSH_RECEIPT_PREFIX + pushKey(message)) ?? 'null') as PushReceipt | null;
    return value && value.id === message.id && value.status === message.status
      && typeof value.read === 'boolean' && typeof value.pending === 'boolean'
      && Number.isFinite(value.expiresAt) ? value : null;
  } catch { return null; }
}
/** `keepBackoff`: a new delivery or read still waits out an earlier failure; a success ends it. */
export function savePushReceipt(message: PushMessage, read: boolean, pending = true, keepBackoff = pending) {
  const old = getPushReceipt(message);
  // Never save announcement text to persistent browser storage.
  const { id, status, expiresAt } = message;
  const receipt: PushReceipt = { id, status, message: '', expiresAt, read: read || old?.read === true, pending };
  if (keepBackoff && old?.failures) Object.assign(receipt, { failures: old.failures, retryAt: old.retryAt, network: old.network });
  set(PUSH_RECEIPT_PREFIX + pushKey(message), JSON.stringify(receipt));
  return receipt;
}
export function pendingPushReceipts(now = Date.now()): PushReceipt[] {
  const keys = new Set(memory.keys());
  try { for (let i = 0; i < localStorage.length; i++) keys.add(localStorage.key(i)!); } catch { /* memory fallback */ }
  const receipts: PushReceipt[] = [];
  for (const key of keys) {
    if (!key.startsWith(PUSH_RECEIPT_PREFIX)) continue;
    try {
      const value = JSON.parse(get(key) ?? 'null') as PushReceipt;
      if (!value || !['test', 'live'].includes(value.status) || typeof value.id !== 'string') continue;
      if (value.expiresAt <= now) {
        // Keep read state after expiry: extending the same document must not resend it.
        if (value.pending) savePushReceipt(value, value.read, false);
      } else if (value.pending) receipts.push(value);
    } catch { /* Ignore damaged browser data. */ }
  }
  return receipts;
}
/** Pending receipts whose wait is over: the only ones allowed to reach Firestore. */
export function duePushReceipts(now = Date.now()): PushReceipt[] {
  return pendingPushReceipts(now).filter((receipt) => typeof receipt.retryAt !== 'number' || receipt.retryAt <= now);
}
/** The wait after `failures` failed reports in a row: from 1 min doubling to 1 h, or from 1 h to 24 h. */
export function pushRetryDelay(code: string, failures: number) {
  const permanent = PERMANENT_FAILURES.has(code);
  return Math.min(permanent ? 24 * HOUR : HOUR, (permanent ? HOUR : MINUTE) * 2 ** (failures - 1));
}
/** After a failed report the receipt stays pending, but off Firestore until its retryAt. */
export function deferPushReceipt(message: Pick<PushMessage, 'id' | 'status'>, code: string, now = Date.now()) {
  const latest = getPushReceipt(message);
  // Already reported by another tab, or gone: there is nothing left to wait for.
  if (!latest?.pending) return latest;
  const previous = latest.failures;
  const failures = (typeof previous === 'number' && previous > 0 ? previous : 0) + 1;
  const network = NETWORK_FAILURES.has(code);
  const receipt: PushReceipt = { ...latest, message: '', failures, retryAt: now + pushRetryDelay(code, failures), network };
  set(PUSH_RECEIPT_PREFIX + pushKey(message), JSON.stringify(receipt));
  return receipt;
}
/**
 * Back online: receipts waiting out a lost or timed-out connection are due at once. Their count
 * stays, so failing again still waits longer than before. Any other failure, such as rules,
 * contention on the shared stats or the quota, or one saved before its kind was kept, waits out
 * its full time: a burst of reconnecting tabs must not retry those all at once.
 */
export function hurryTransientPushReceipts(now = Date.now()) {
  for (const receipt of pendingPushReceipts(now)) {
    if (receipt.network !== true || typeof receipt.retryAt !== 'number' || receipt.retryAt <= now) continue;
    set(PUSH_RECEIPT_PREFIX + pushKey(receipt), JSON.stringify({ ...receipt, message: '', retryAt: now }));
  }
}
