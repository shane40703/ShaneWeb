import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { subjectsOfQuestionIds } from '@/lib/question-path';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('storage access', () => {
  it('round-trips a value', () => {
    expect(writeStoredValue('key', 'value')).toBe('saved');
    expect(readStoredValue('key')).toBe('value');
  });

  it('reports a full quota instead of failing silently', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError');
    });
    expect(writeStoredValue('key', 'value')).toBe('quota-exceeded');
  });

  it('reports unusable storage separately from a full quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(writeStoredValue('key', 'value')).toBe('unavailable');
  });

  it('treats an unreadable store as empty rather than throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(readStoredValue('key')).toBeNull();
  });
});

describe('subjectsOfQuestionIds', () => {
  it('returns the referenced subjects once each, in catalog order', () => {
    expect(
      subjectsOfQuestionIds(['env-114-02', 'law-114-01', 'law-113-01', 'env-112-01']),
    ).toEqual(['law', 'env']);
  });

  it('ignores ids that are not question ids', () => {
    expect(subjectsOfQuestionIds(['', 'nope', 'law-14-1'])).toEqual([]);
  });
});
