/**
 * Thin wrapper around localStorage. Every read and write can throw — Safari's
 * private mode denies access outright, and any browser rejects writes once the
 * origin's quota is full. Callers need to distinguish "the browser is full"
 * from "storage is unusable" so the UI can explain why work stopped saving.
 */
export type StorageWriteResult = 'saved' | 'quota-exceeded' | 'unavailable';

const quotaErrorNames = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);

function isQuotaExceeded(error: unknown) {
  if (!(error instanceof DOMException)) return false;
  // Firefox reports 1014, other engines historically used code 22.
  return quotaErrorNames.has(error.name) || error.code === 22 || error.code === 1014;
}

export function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: string): StorageWriteResult {
  try {
    window.localStorage.setItem(key, value);
    return 'saved';
  } catch (error) {
    return isQuotaExceeded(error) ? 'quota-exceeded' : 'unavailable';
  }
}
