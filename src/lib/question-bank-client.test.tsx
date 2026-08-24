import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSubjectQuestions } from '@/lib/question-bank-client';
import type { Question, SubjectId } from '@/lib/types';

function question(id: string, subject: SubjectId): Question {
  return {
    id,
    subject,
    year: 114,
    questionNumber: 1,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `${id} 題幹`,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSubjectQuestions', () => {
  it('does not request the API when no subject is selected', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSubjectQuestions([]));

    expect(result.current.status).toBe('ready');
    expect(result.current.questions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps caller order when flattening cached subject requests', async () => {
    const banks: Partial<Record<SubjectId, Question[]>> = {
      env: [question('env-114-01', 'env')],
      law: [question('law-114-01', 'law')],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const subject = url.match(/\/api\/questions\/([^?]+)/)?.[1] as SubjectId;
      const year = Number(new URL(url, 'https://example.test').searchParams.get('year'));
      return {
        ok: true,
        json: async () =>
          year === 114 ? banks[subject] ?? [] : [],
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ subjects }: { subjects: SubjectId[] }) =>
        useSubjectQuestions(subjects),
      { initialProps: { subjects: ['env', 'law'] } },
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.questions.map((item) => item.id)).toEqual([
      'env-114-01',
      'law-114-01',
    ]);

    rerender({ subjects: ['law', 'env'] });

    await waitFor(() =>
      expect(result.current.questions.map((item) => item.id)).toEqual([
        'law-114-01',
        'env-114-01',
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(26);
  });

  it('limits each subject to one in-flight year request', async () => {
    let active = 0;
    let peak = 0;
    const fetchMock = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return { ok: true, json: async () => [] } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSubjectQuestions(['construction']));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(peak).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });

  it('keeps successful years visible and retries only a failed year', async () => {
    let failedOnce = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const year = Number(
        new URL(String(input), 'https://example.test').searchParams.get('year'),
      );
      if (year === 113 && !failedOnce) {
        failedOnce = true;
        return { ok: false, status: 503 } as Response;
      }
      return {
        ok: true,
        json: async () => year === 114 ? [question('structure-114-01', 'structure')] : [],
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSubjectQuestions(['structure']));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.questions.map((item) => item.id)).toEqual([
      'structure-114-01',
    ]);

    result.current.retry();
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.questions.map((item) => item.id)).toEqual([
      'structure-114-01',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(14);
  });
});
