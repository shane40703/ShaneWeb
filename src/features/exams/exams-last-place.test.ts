import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXAMS_PLACE_KEY,
  examsPlaceFrom,
  examsReturnHref,
  examsStart,
  forgetExamsPlace,
  rememberExamsPlace,
} from './exams-last-place';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('examsPlaceFrom', () => {
  it.each([
    '/exams',
    '/exams/law',
    '/exams/law/114',
    '/exams/law/114/3',
    '/exams/env/100/written-1?tab=notes',
    '/exams/law/114/37?tab=discussion',
  ])('keeps %s as it is', (value) => {
    expect(examsPlaceFrom(value)).toBe(value);
  });

  it.each([
    ['/exams/law?tab=notes', '/exams/law'],
    ['/exams/law/114/3?tab=answers', '/exams/law/114/3'],
    ['/exams/law/114/3?utm_source=threads&tab=notes', '/exams/law/114/3?tab=notes'],
  ])('keeps a tab only where the address has one: %s', (value, place) => {
    expect(examsPlaceFrom(value)).toBe(place);
  });

  it.each([
    '/practice',
    '/exams/foo',
    '/exams/law/114/03',
    '/exams/law/abc',
    '/exams/law/114/3/4',
    '/exams/',
    '/examsfoo',
    '//evil.com',
    'https://evil.com/exams',
    '',
    null,
    undefined,
  ])('rejects %j', (value) => {
    expect(examsPlaceFrom(value)).toBeUndefined();
  });
});

describe('the sidebar’s place in 歷屆試題討論版', () => {
  it('starts at the newest 法規 paper’s first question', () => {
    expect(examsStart).toBe('/exams/law/114/1');
    expect(examsReturnHref()).toBe('/exams/law/114/1');
  });

  it('remembers a place for this tab and for the browser', () => {
    rememberExamsPlace('/exams/law/114/7?tab=notes');
    expect(window.sessionStorage.getItem(EXAMS_PLACE_KEY)).toBe(
      '/exams/law/114/7?tab=notes',
    );
    expect(window.localStorage.getItem(EXAMS_PLACE_KEY)).toBe(
      '/exams/law/114/7?tab=notes',
    );
    expect(examsReturnHref()).toBe('/exams/law/114/7?tab=notes');
  });

  it('prefers this tab’s place, then the browser’s, then the start', () => {
    window.localStorage.setItem(EXAMS_PLACE_KEY, '/exams/law/108/12');
    window.sessionStorage.setItem(EXAMS_PLACE_KEY, '/exams/law/114/7');
    expect(examsReturnHref()).toBe('/exams/law/114/7');

    // A new tab has nothing of its own yet.
    window.sessionStorage.clear();
    expect(examsReturnHref()).toBe('/exams/law/108/12');

    // A value the board never writes falls through to the next store.
    window.sessionStorage.setItem(EXAMS_PLACE_KEY, '/exams/law/114/03');
    expect(examsReturnHref()).toBe('/exams/law/108/12');
    window.localStorage.setItem(EXAMS_PLACE_KEY, '//evil.com');
    expect(examsReturnHref()).toBe(examsStart);
  });

  it('opens the start when storage cannot be used', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => rememberExamsPlace('/exams/law/114/7')).not.toThrow();
    expect(examsReturnHref()).toBe(examsStart);
  });

  it('forgets a place only when it names the page that was not found', () => {
    rememberExamsPlace('/exams/law/114/99?tab=notes');
    forgetExamsPlace('/exams/law/114/9');
    expect(examsReturnHref()).toBe('/exams/law/114/99?tab=notes');

    forgetExamsPlace('/exams/law/114/99');
    expect(window.sessionStorage.getItem(EXAMS_PLACE_KEY)).toBeNull();
    expect(window.localStorage.getItem(EXAMS_PLACE_KEY)).toBeNull();
    expect(examsReturnHref()).toBe(examsStart);
  });

  it('forgets it in each store on its own', () => {
    window.localStorage.setItem(EXAMS_PLACE_KEY, '/exams/law/114/99');
    window.sessionStorage.setItem(EXAMS_PLACE_KEY, '/exams/law/113/1');
    forgetExamsPlace('/exams/law/114/99');
    expect(window.localStorage.getItem(EXAMS_PLACE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(EXAMS_PLACE_KEY)).toBe('/exams/law/113/1');
  });
});
