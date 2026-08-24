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
const subjectRequests = new Map<string, Promise<Question[]>>();
const subjectYearRequests = new Map<string, Promise<Question[]>>();
const noQuestions: Question[] = [];

class PartialQuestionBankError extends Error {
  constructor(readonly questions: Question[]) {
    super('部分年度題庫載入失敗');
  }
}

function fetchSubjectYear(subject: SubjectId, year: number) {
  const key = `${subject}:${year}`;
  const cached = subjectYearRequests.get(key);
  if (cached) return cached;

  const request = fetch(`/question-data/${subject}/${year}.json`).then(
    async (response) => {
      if (!response.ok) throw new Error(`題庫載入失敗（${response.status}）`);
      return (await response.json()) as Question[];
    },
  );
  request.catch(() => subjectYearRequests.delete(key));
  subjectYearRequests.set(key, request);
  return request;
}

function fetchSubject(subject: SubjectId, requestedYears: readonly number[]) {
  const subjectKey = `${subject}:${requestedYears.join(',')}`;
  const cached = subjectRequests.get(subjectKey);
  if (cached) return cached;

  // Full-subject responses grow beyond Vercel's function response limit as the
  // bank expands. Year-sized chunks stay small and can be cached independently.
  // Keep one request per subject in flight. Four subjects may still load in
  // parallel, but Vercel no longer receives 52 simultaneous cold requests.
  let failed = false;
  const request = requestedYears.reduce<Promise<Question[]>>(
    (loaded, year) =>
      loaded.then(async (questions) => {
        try {
          return [...questions, ...(await fetchSubjectYear(subject, year))];
        } catch {
          failed = true;
          return questions;
        }
      }),
    Promise.resolve([]),
  ).then((questions) => {
    if (failed) throw new PartialQuestionBankError(questions);
    return questions;
  });
  // A failed request must not poison the cache, otherwise retrying is pointless.
  request.catch(() => subjectRequests.delete(subjectKey));
  subjectRequests.set(subjectKey, request);
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
export function useSubjectQuestions(
  subjects: readonly SubjectId[],
  requestedYears: readonly number[] = years,
): QuestionBankResult {
  const wantedSubjects = [...new Set(subjects)];
  const yearKey = [...new Set(requestedYears)]
    .filter((year) => years.includes(year))
    .join(',');
  const key = `${[...wantedSubjects].sort().join(',')}|${yearKey}`;
  const orderKey = wantedSubjects.join(',');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedBank>();

  useEffect(() => {
    const wanted = orderKey ? (orderKey.split(',') as SubjectId[]) : [];
    const wantedYears = yearKey
      ? yearKey.split(',').map(Number)
      : [];
    if (!wanted.length) return;

    let cancelled = false;
    Promise.allSettled(wanted.map((subject) => fetchSubject(subject, wantedYears)))
      .then((results) => {
        if (!cancelled) {
          const questions = results.flatMap((result) =>
            result.status === 'fulfilled'
              ? result.value
              : result.reason instanceof PartialQuestionBankError
                ? result.reason.questions
                : [],
          );
          setLoaded({
            key,
            orderKey,
            attempt,
            status: results.some((result) => result.status === 'rejected')
              ? 'error'
              : 'ready',
            questions,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, orderKey, yearKey, attempt]);

  const current =
    loaded?.key === key &&
    loaded.orderKey === orderKey &&
    loaded.attempt === attempt
      ? loaded
      : undefined;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    questions: current?.questions ?? noQuestions,
    status: !orderKey ? 'ready' : (current?.status ?? 'loading'),
    retry,
  };
}
