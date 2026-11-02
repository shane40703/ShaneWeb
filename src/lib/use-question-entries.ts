import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { preloadPaper, useQuestionBodies } from '@/lib/question-bank-client';
import { examsQuestionId, parseQuestionId } from '@/lib/question-path';
import type { Question } from '@/lib/types';
import {
  questionRefs,
  type PaperIndex,
  type QuestionEntry,
} from '@/question-bank/derived-data';

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * What 考古題討論版 and 我的筆記 navigate over: every question of the bank as an entry, from the
 * paper index, with a body once its paper has loaded. Only the paper in the URL downloads, and
 * the one next to it when the reader is about to cross into it.
 */
export function useQuestionEntries(paperIndex: PaperIndex, initialQuestion?: Question) {
  const router = useRouter();
  const refs = useMemo(() => questionRefs(paperIndex), [paperIndex]);
  const requestedId =
    examsQuestionId(router.query.slug, refs) ?? valueOf(router.query.question);
  // A static page reads its query after hydration; asking earlier fetches the wrong paper.
  const currentId = router.isReady ? (requestedId ?? initialQuestion?.id) : undefined;
  const wanted = useMemo(() => (currentId ? [currentId] : []), [currentId]);
  const { byId, status, retry } = useQuestionBodies(wanted);

  const entries = useMemo<QuestionEntry[]>(
    () =>
      refs.map(
        (ref) =>
          byId.get(ref.id) ?? (ref.id === initialQuestion?.id ? initialQuestion : ref),
      ),
    [byId, initialQuestion, refs],
  );

  useEffect(() => {
    if (!currentId) return;
    const position = refs.findIndex((ref) => ref.id === currentId);
    const current = parseQuestionId(currentId);
    if (position < 0 || !current) return;
    for (const neighbour of [refs[position - 1], refs[position + 1]]) {
      if (neighbour?.subject === current.subject && neighbour.year !== current.year) {
        preloadPaper(neighbour.subject, neighbour.year);
      }
    }
  }, [currentId, refs]);

  return { entries, status, retry };
}
