import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadPaper, useQuestionBodies } from '@/lib/question-bank-client';
import type { Question } from '@/lib/types';
import type { PaperIndex } from '@/question-bank/derived-data';
import { useQuestionEntries } from './use-question-entries';

const mocks = vi.hoisted(() => ({
  router: { isReady: true, query: {} as Record<string, string | string[]> },
  useQuestionBodies: vi.fn(),
  preloadPaper: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/lib/question-bank-client', () => ({
  preloadPaper: mocks.preloadPaper,
  useQuestionBodies: mocks.useQuestionBodies,
}));

const index: PaperIndex = {
  law: [
    [114, 2, 0],
    [113, 2, 0],
  ],
  env: [[114, 1, 0]],
};

const initial = { id: 'law-114-01', content: [] } as unknown as Question;

function asked() {
  return vi.mocked(useQuestionBodies).mock.lastCall?.[0];
}

describe('useQuestionEntries', () => {
  beforeEach(() => {
    mocks.router.isReady = true;
    mocks.router.query = {};
    mocks.preloadPaper.mockClear();
    mocks.useQuestionBodies.mockReset();
    mocks.useQuestionBodies.mockReturnValue({
      byId: new Map(),
      status: 'ready',
      retry: vi.fn(),
    });
  });

  afterEach(cleanup);

  it('knows every question from the index, and keeps the prerendered body', () => {
    const { result } = renderHook(() => useQuestionEntries(index, initial));

    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      'law-114-01',
      'law-114-02',
      'law-113-01',
      'law-113-02',
      'env-114-01',
    ]);
    expect(result.current.entries[0]).toBe(initial);
  });

  it('asks only for the question in the URL', () => {
    mocks.router.query = { question: 'env-114-01' };
    renderHook(() => useQuestionEntries(index, initial));

    expect(asked()).toEqual(['env-114-01']);
  });

  it('asks for nothing before the URL can be read', () => {
    mocks.router.isReady = false;
    mocks.router.query = {};
    renderHook(() => useQuestionEntries(index, initial));

    expect(asked()).toEqual([]);
    expect(preloadPaper).not.toHaveBeenCalled();
  });

  it('fetches the next paper of the subject at its edge, and only there', async () => {
    mocks.router.query = { question: 'law-114-02' };
    renderHook(() => useQuestionEntries(index, initial));

    await waitFor(() => expect(preloadPaper).toHaveBeenCalledWith('law', 113));
    expect(preloadPaper).toHaveBeenCalledOnce();
  });

  it('does not cross into another subject', () => {
    mocks.router.query = { question: 'law-113-02' };
    renderHook(() => useQuestionEntries(index, initial));

    expect(preloadPaper).not.toHaveBeenCalled();
  });

  it('asks for the question at a question address', () => {
    mocks.router.query = { slug: ['law', '113', '2'] };
    renderHook(() => useQuestionEntries(index, initial));

    expect(asked()).toEqual(['law-113-02']);
  });

  it('downloads a paper for its own page, and nothing next to it', () => {
    mocks.router.query = { slug: ['law', '113'] };
    renderHook(() => useQuestionEntries(index));

    expect(asked()).toEqual(['law-113-01']);
    expect(preloadPaper).not.toHaveBeenCalled();
  });

  it('downloads no question for 考古題討論版 itself or a subject', () => {
    for (const slug of [[], ['law'], ['env']]) {
      mocks.router.query = { slug };
      renderHook(() => useQuestionEntries(index));
      expect(asked()).toEqual([]);
    }
    mocks.router.query = {};
    renderHook(() => useQuestionEntries(index));
    expect(asked()).toEqual([]);
    expect(preloadPaper).not.toHaveBeenCalled();
  });

  it('keeps a subject page quiet even after a question was prerendered', () => {
    mocks.router.query = { slug: ['law'] };
    renderHook(() => useQuestionEntries(index, initial));

    expect(asked()).toEqual([]);
  });

  it('stays quiet in the middle of a paper', () => {
    mocks.router.query = { question: 'law-114-02' };
    renderHook(() => useQuestionEntries({ law: [[114, 3, 0]] }, initial));

    expect(preloadPaper).not.toHaveBeenCalled();
  });
});
