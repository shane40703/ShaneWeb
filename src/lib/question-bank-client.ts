import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { parseQuestionId } from '@/lib/question-path';
import type { Question, SubjectId } from '@/lib/types';
import { years } from '@/question-bank/catalog';
import {
  facetQuestions,
  similarFileKey,
  type SimilarRow,
  type SubjectFacets,
  type SubjectStems,
} from '@/question-bank/derived-data';

export type QuestionBankStatus = 'loading' | 'ready' | 'error';

export interface QuestionBankResult {
  questions: Question[];
  status: QuestionBankStatus;
  retry: () => void;
}

/**
 * Versioned URLs are cached for a year (next.config.ts), so a file is downloaded once per bank
 * version and a repeat visit makes no request at all. The version is a query string, not a path:
 * a tab left open across a deployment keeps working, because the CDN serves the same file for
 * any query. Development has no version and always revalidates.
 */
const dataVersion = process.env.NEXT_PUBLIC_QUESTION_DATA_VERSION;

function dataUrl(path: string) {
  return `/question-data/${path}${dataVersion ? `?v=${dataVersion}` : ''}`;
}

async function fetchJson<T>(path: string) {
  const response = await fetch(dataUrl(path));
  if (!response.ok) throw new Error(`題庫載入失敗（${response.status}）`);
  return (await response.json()) as T;
}

interface Slot<T> {
  value?: T;
  failed?: boolean;
  request?: Promise<T>;
}

/** One kind of file: loaded once per key, kept for the life of the tab, readable synchronously. */
function createFileStore<T>() {
  const slots = new Map<string, Slot<T>>();
  const listeners = new Set<() => void>();
  let revision = 0;

  function changed() {
    revision += 1;
    listeners.forEach((listener) => listener());
  }

  return {
    load(key: string): Promise<T> {
      const slot = slots.get(key);
      if (slot?.value !== undefined) return Promise.resolve(slot.value);
      if (slot?.request) return slot.request;
      const request = fetchJson<T>(key).then(
        (value) => {
          slots.set(key, { value });
          changed();
          return value;
        },
        (error: unknown) => {
          // A failed request must not poison the cache, otherwise retrying is pointless.
          slots.set(key, { failed: true });
          changed();
          throw error;
        },
      );
      slots.set(key, { request });
      changed();
      return request;
    },
    peek: (key: string) => slots.get(key)?.value,
    failed: (key: string) => Boolean(slots.get(key)?.failed),
    pending: (key: string) => {
      const slot = slots.get(key);
      return !slot || Boolean(slot.request);
    },
    values: () =>
      [...slots.values()].flatMap((slot) => (slot.value === undefined ? [] : [slot.value])),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    revision: () => revision,
  };
}

type FileStore<T> = ReturnType<typeof createFileStore<T>>;

const noRevision = () => 0;

/** Loads `keys`, and re-renders as each file arrives instead of when the last one does. */
function useFiles<T>(store: FileStore<T>, keys: readonly string[]) {
  const joined = keys.join('\n');
  const [attempt, setAttempt] = useState(0);
  const request = `${attempt}\n${joined}`;
  const revision = useSyncExternalStore(store.subscribe, store.revision, noRevision);
  // A failure from before this request is not its answer: asking again moves the revision on.
  const [asked, setAsked] = useState({ request, revision });
  if (asked.request !== request) setAsked({ request, revision });

  useEffect(() => {
    if (!joined) return;
    joined.split('\n').forEach((key) => {
      store.load(key).catch(() => {});
    });
  }, [attempt, joined, store]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return useMemo(() => {
    void revision;
    const wanted = joined ? joined.split('\n') : [];
    const failed = wanted.some((key) => store.failed(key));
    const status: QuestionBankStatus =
      wanted.some((key) => store.pending(key)) || (failed && asked.revision === revision)
        ? 'loading'
        : failed
          ? 'error'
          : 'ready';
    return {
      values: wanted.flatMap((key) => store.peek(key) ?? []) as T extends readonly unknown[]
        ? T[number][]
        : never,
      status,
      retry,
    };
  }, [asked.revision, joined, retry, revision, store]);
}

const paperStore = createFileStore<Question[]>();
const facetStore = createFileStore<SubjectFacets>();
const stemStore = createFileStore<SubjectStems>();
const similarStore = createFileStore<SimilarRow[]>();

const paperFile = (subject: SubjectId, year: number) => `${subject}/${year}.json`;

/** Starts a paper's download; for the next paper before a reader reaches it. */
export function preloadPaper(subject: SubjectId, year: number) {
  paperStore.load(paperFile(subject, year)).catch(() => {});
}

/**
 * Whole papers on demand. The result grows as files arrive, and `status` stays `loading` until
 * all of them have settled, so a page can show what it has while the rest is on its way.
 */
export function useSubjectQuestions(
  subjects: readonly SubjectId[],
  requestedYears: readonly number[] = years,
): QuestionBankResult {
  const wantedSubjects = [...new Set(subjects)];
  const wantedYears = [...new Set(requestedYears)].filter((year) => years.includes(year));
  const keys = wantedSubjects.flatMap((subject) =>
    wantedYears.map((year) => paperFile(subject, year)),
  );
  const { values, status, retry } = useFiles(paperStore, keys);
  return { questions: values, status, retry };
}

function papersOf(ids: readonly string[]) {
  return [
    ...new Set(
      ids.flatMap((id) => {
        const parsed = parseQuestionId(id);
        // A year outside the catalog has no file: the question simply does not exist.
        return parsed && years.includes(parsed.year)
          ? [paperFile(parsed.subject, parsed.year)]
          : [];
      }),
    ),
  ];
}

/**
 * The bodies these questions need: only their papers download. `byId` holds every question this
 * tab has loaded so far, so moving back to an earlier question never waits.
 */
export function useQuestionBodies(ids: readonly string[]) {
  const { status, retry } = useFiles(paperStore, papersOf(ids));
  const revision = useSyncExternalStore(paperStore.subscribe, paperStore.revision, noRevision);
  const byId = useMemo(() => {
    void revision;
    return new Map(
      paperStore.values().flat().map((question) => [question.id, question] as const),
    );
  }, [revision]);
  return { byId, status, retry };
}

/** The bodies of the questions a page shows, from facets or from questions already whole. */
export function useFilledBodies(questions: readonly Question[]) {
  const { byId, status, retry } = useQuestionBodies(
    questions.flatMap((question) => (question.content.length ? [] : [question.id])),
  );
  const bodyOf = useCallback(
    (question: Question) => (question.content.length ? question : byId.get(question.id)),
    [byId],
  );
  return { bodyOf, status, retry };
}

/** For an action that needs a whole set at once, such as the printed paper. */
export async function loadQuestionBodies(ids: readonly string[]) {
  const papers = await Promise.all(papersOf(ids).map((file) => paperStore.load(file)));
  return new Map(papers.flat().map((question) => [question.id, question] as const));
}

/**
 * Body-less questions of these subjects: what a screen counts, filters, draws and grades by.
 * Same shape as a bank, so the code that does those things does not change.
 */
export function useSubjectFacets(subjects: readonly SubjectId[]): QuestionBankResult {
  const wanted = [...new Set(subjects)];
  const keys = wanted.map((subject) => `${subject}/facets.json`);
  const joined = keys.join('\n');
  const { status, retry } = useFiles(facetStore, keys);
  const revision = useSyncExternalStore(facetStore.subscribe, facetStore.revision, noRevision);
  const questions = useMemo(() => {
    void revision;
    return joined
      ? joined.split('\n').flatMap((key) => {
          const facets = facetStore.peek(key);
          return facets ? facetQuestions(key.split('/')[0] as SubjectId, facets) : [];
        })
      : [];
  }, [joined, revision]);
  return { questions, status, retry };
}

/** 考題分析 rows of one subject, as soon as the page needs a year it did not ship with. */
export function useSubjectStems(subject: SubjectId | null) {
  const key = subject ? `${subject}/stems.json` : null;
  const { status } = useFiles(stemStore, key ? [key] : []);
  const revision = useSyncExternalStore(stemStore.subscribe, stemStore.revision, noRevision);
  return useMemo(() => {
    void revision;
    return { stems: key ? stemStore.peek(key) : undefined, status };
  }, [key, revision, status]);
}

/** 類似考題 rows of one fine topic. */
export function useSimilarRows(topic: string | null) {
  const key = topic ? `law/similar/${similarFileKey(topic)}.json` : null;
  const { status, retry } = useFiles(similarStore, key ? [key] : []);
  const revision = useSyncExternalStore(similarStore.subscribe, similarStore.revision, noRevision);
  return useMemo(() => {
    void revision;
    return { rows: key ? similarStore.peek(key) : undefined, status, retry };
  }, [key, retry, revision, status]);
}
