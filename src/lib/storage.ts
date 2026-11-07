/**
 * Thin wrapper around localStorage, and sessionStorage for what belongs to one browser tab.
 * Every read and write can throw — Safari's private mode denies access outright, and any
 * browser rejects writes once the origin's quota is full. Callers need to distinguish "the
 * browser is full" from "storage is unusable" so the UI can explain why work stopped saving.
 */
import { notifyProgressChanged } from './progress-events';

export type StorageWriteResult = 'saved' | 'quota-exceeded' | 'unavailable';

const quotaErrorNames = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

function isQuotaExceeded(error: unknown) {
  if (!(error instanceof DOMException)) return false;
  // Firefox reports 1014, other engines historically used code 22.
  return quotaErrorNames.has(error.name) || error.code === 22 || error.code === 1014;
}

// Read at each call: even reaching the store can throw.
const local = () => window.localStorage;
const session = () => window.sessionStorage;

function readFrom(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}

function writeTo(store: () => Storage, key: string, value: string): StorageWriteResult {
  try {
    store().setItem(key, value);
    return 'saved';
  } catch (error) {
    return isQuotaExceeded(error) ? 'quota-exceeded' : 'unavailable';
  }
}

function removeFrom(store: () => Storage, key: string) {
  try {
    store().removeItem(key);
  } catch {
    // An unusable store holds nothing to remove.
  }
}

export function readStoredValue(key: string) {
  return readFrom(local, key);
}

export function writeStoredValue(key: string, value: string) {
  const result = writeTo(local, key, value);
  if (result === 'saved') notifyProgressChanged(key);
  return result;
}

export function removeStoredValue(key: string) {
  removeFrom(local, key);
}

export function readSessionValue(key: string) {
  return readFrom(session, key);
}

export function writeSessionValue(key: string, value: string) {
  return writeTo(session, key, value);
}

export function removeSessionValue(key: string) {
  removeFrom(session, key);
}
