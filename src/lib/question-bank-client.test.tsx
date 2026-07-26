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
  it('keeps caller order when flattening cached subject requests', async () => {
    const banks: Partial<Record<SubjectId, Question[]>> = {
      env: [question('env-114-01', 'env')],
      law: [question('law-114-01', 'law')],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const subject = String(input).split('/').at(-1) as SubjectId;
      return {
        ok: true,
        json: async () => banks[subject] ?? [],
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
