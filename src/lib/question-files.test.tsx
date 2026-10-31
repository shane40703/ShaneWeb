import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@/lib/types';
import type { SubjectFacets } from '@/question-bank/derived-data';

/** The stores live as long as the tab, so every test starts from a fresh module. */
async function client() {
  return import('@/lib/question-bank-client');
}

function stubFiles(respond: (url: string) => unknown) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const value = respond(url);
    if (value === undefined) return { ok: false, status: 503 };
    return { ok: true, json: async () => value };
  });
  return urls;
}

function body(id: string): Question {
  const [subject, year, number] = id.split('-');
  return {
    id,
    subject,
    year: Number(year),
    questionNumber: Number(number),
    topic: '主題',
    primaryCategory: '分類',
    tags: [],
    text: `${id} 題幹`,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  } as Question;
}

const facets: SubjectFacets = {
  classes: [['建築法', '建築法']],
  papers: [{ y: 114, k: [0, 0], a: [1, 0] }],
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('question files', () => {
  it('asks for one file per paper, however many of its questions are wanted', async () => {
    const urls = stubFiles(() => [body('law-114-01'), body('law-114-02')]);
    const { useQuestionBodies } = await client();

    const { result } = renderHook(() => useQuestionBodies(['law-114-01', 'law-114-02']));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls).toEqual(['/question-data/law/114.json']);
    expect(result.current.byId.get('law-114-02')?.text).toBe('law-114-02 題幹');
  });

  it('versions every URL of a build, and keeps a file for the life of the tab', async () => {
    vi.stubEnv('NEXT_PUBLIC_QUESTION_DATA_VERSION', 'abc123');
    const urls = stubFiles(() => []);
    const { loadQuestionBodies } = await client();

    await loadQuestionBodies(['law-114-01']);
    await loadQuestionBodies(['law-114-02']);

    expect(urls).toEqual(['/question-data/law/114.json?v=abc123']);
  });

  it('does not ask for a paper outside the catalog', async () => {
    const urls = stubFiles(() => []);
    const { useQuestionBodies } = await client();

    const { result } = renderHook(() => useQuestionBodies(['law-099-01']));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(urls).toEqual([]);
  });

  it('builds body-less questions from facets, with their real answer key', async () => {
    stubFiles(() => facets);
    const { useSubjectFacets } = await client();

    const { result } = renderHook(() => useSubjectFacets(['law']));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.questions.map((question) => question.id)).toEqual([
      'law-114-01',
      'law-114-02',
    ]);
    expect(result.current.questions[0]).toMatchObject({
      text: '',
      content: [],
      answerKey: { kind: 'accepted', options: [0] },
    });
    expect(result.current.questions[1].answerKey).toEqual({ kind: 'all-credit' });
  });

  it('fills in only the questions that have no body yet', async () => {
    const urls = stubFiles(() => [body('law-114-01')]);
    const { useFilledBodies } = await client();
    const whole = body('env-114-01');
    const empty = { ...body('law-114-01'), text: '', content: [] };

    const { result } = renderHook(() => useFilledBodies([whole, empty]));

    await waitFor(() =>
      expect(result.current.bodyOf(empty)?.text).toBe('law-114-01 題幹'),
    );
    expect(result.current.bodyOf(whole)).toBe(whole);
    expect(urls).toEqual(['/question-data/law/114.json']);
  });

  it('reports stems that fail to arrive', async () => {
    stubFiles(() => undefined);
    const { useSubjectStems } = await client();

    const { result } = renderHook(() => useSubjectStems('env'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.stems).toBeUndefined();
  });

  it('never reports an old failure for a file it is asking for again', async () => {
    let online = false;
    stubFiles(() => (online ? [body('law-113-01')] : undefined));
    const { useQuestionBodies } = await client();
    const statuses: string[] = [];

    const { rerender } = renderHook(
      ({ ids }) => {
        const result = useQuestionBodies(ids);
        statuses.push(`${ids[0]}:${result.status}`);
        return result;
      },
      { initialProps: { ids: ['law-113-01'] } },
    );
    await waitFor(() => expect(statuses.at(-1)).toBe('law-113-01:error'));

    rerender({ ids: [] as string[] });
    online = true;
    statuses.length = 0;
    rerender({ ids: ['law-113-01'] });

    await waitFor(() => expect(statuses.at(-1)).toBe('law-113-01:ready'));
    expect(statuses).not.toContain('law-113-01:error');
  });
});
