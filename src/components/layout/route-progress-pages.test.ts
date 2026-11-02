import { describe, expect, it } from 'vitest';
import { staysOnPage } from './route-progress';

describe('staysOnPage', () => {
  it('treats every address under a catch-all route as one page', () => {
    expect(staysOnPage('/exams/[[...slug]]', '/exams')).toBe(true);
    expect(staysOnPage('/exams/[[...slug]]', '/exams/law/114/3')).toBe(true);
    expect(staysOnPage('/exams/[[...slug]]', '/exams-archive')).toBe(false);
    expect(staysOnPage('/exams/[[...slug]]', '/practice')).toBe(false);
  });

  it('compares any other page by its path', () => {
    expect(staysOnPage('/practice', '/practice')).toBe(true);
    expect(staysOnPage('/practice', '/practice/quiz')).toBe(false);
  });
});
