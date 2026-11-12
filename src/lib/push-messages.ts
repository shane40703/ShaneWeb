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
}
export const PUSH_MODE_KEY = 'shaneweb:push-test';
export const PUSH_BROWSER_KEY = 'shaneweb:push-browser';
export const PUSH_RECEIPT_PREFIX = 'shaneweb:push-receipt:';
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
export function savePushReceipt(message: PushMessage, read: boolean, pending = true) {
  const old = getPushReceipt(message);
  // Never save announcement text to persistent browser storage.
  const receipt: PushReceipt = { ...message, message: '', read: read || old?.read === true, pending };
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
