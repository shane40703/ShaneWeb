import { useCallback, useEffect, useState } from 'react';
import type { Question, SubjectId } from '@/lib/types';
import { years } from '@/question-bank/catalog';

export type QuestionBankStatus = 'loading' | 'ready' | 'error';

export interface QuestionBankResult {
  questions: Question[];
  status: QuestionBankStatus;
  retry: () => void;
}

/**
 * Requests are cached for the lifetime of the tab so moving between question
 * pages, notes, and history reuses the same year-sized downloads.
 */
const subjectRequests = new Map<SubjectId, Promise<Question[]>>();
const subjectYearRequests = new Map<string, Promise<Question[]>>();
const noQuestions: Question[] = [];

function fetchSubjectYear(subject: SubjectId, year: number) {
  const key = `${subject}:${year}`;
  const cached = subjectYearRequests.get(key);
  if (cached) return cached;

  const request = fetch(`/api/questions/${subject}?year=${year}`).then(
    async (response) => {
      if (!response.ok) throw new Error(`題庫載入失敗（${response.status}）`);
      return (await response.json()) as Question[];
    },
  );
  request.catch(() => subjectYearRequests.delete(key));
  subjectYearRequests.set(key, request);
  return request;
}

function fetchSubject(subject: SubjectId) {
  const cached = subjectRequests.get(subject);
  if (cached) return cached;

  // Full-subject responses grow beyond Vercel's function response limit as the
  // bank expands. Year-sized chunks stay small and can be cached independently.
  // Keep one request per subject in flight. Four subjects may still load in
  // parallel, but Vercel no longer receives 52 simultaneous cold requests.
  const request = years.reduce<Promise<Question[]>>(
    (loaded, year) =>
      loaded.then(async (questions) => [
        ...questions,
        ...(await fetchSubjectYear(subject, year)),
      ]),
    Promise.resolve([]),
  );
  // A failed request must not poison the cache, otherwise retrying is pointless.
  request.catch(() => subjectRequests.delete(subject));
  subjectRequests.set(subject, request);
  return request;
}

interface LoadedBank {
  key: string;
  orderKey: string;
  attempt: number;
  status: 'ready' | 'error';
  questions: Question[];
}

/**
 * Loads whole subjects on demand. The sorted key identifies the requested set,
 * while `orderKey` keeps the caller's subject order for the flattened result.
 * Both are strings so callers can pass a freshly derived array on every render.
 */
export function useSubjectQuestions(subjects: readonly SubjectId[]): QuestionBankResult {
  const wantedSubjects = [...new Set(subjects)];
  const key = [...wantedSubjects].sort().join(',');
  const orderKey = wantedSubjects.join(',');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedBank>();

  useEffect(() => {
    const wanted = orderKey ? (orderKey.split(',') as SubjectId[]) : [];
    if (!wanted.length) return;

    let cancelled = false;
    Promise.all(wanted.map(fetchSubject))
      .then((banks) => {
        if (!cancelled) {
          setLoaded({
            key,
            orderKey,
            attempt,
            status: 'ready',
            questions: banks.flat(),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({
            key,
            orderKey,
            attempt,
            status: 'error',
            questions: noQuestions,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, orderKey, attempt]);

  const current =
    loaded?.key === key &&
    loaded.orderKey === orderKey &&
    loaded.attempt === attempt
      ? loaded
      : undefined;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    questions: current?.questions ?? noQuestions,
    status: !key ? 'ready' : (current?.status ?? 'loading'),
    retry,
  };
}
