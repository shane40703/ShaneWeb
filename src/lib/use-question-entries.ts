import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { preloadPaper, useQuestionBodies } from '@/lib/question-bank-client';
import {
  examsPlace,
  examsQuestionId,
  examsSlugParts,
  parseQuestionId,
} from '@/lib/question-path';
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
 * the one next to it when the reader is about to cross into it. A paper's own page downloads
 * that paper, for its topics and so that its first question opens at once; 考古題討論版 itself
 * and a subject's page download nothing.
 */
export function useQuestionEntries(paperIndex: PaperIndex, initialQuestion?: Question) {
  const router = useRouter();
  const refs = useMemo(() => questionRefs(paperIndex), [paperIndex]);
  const slug = examsSlugParts(router.query.slug);
  const place = examsPlace(slug);
  // 我的筆記 has no slug: it opens on ?question= or on the prerendered question.
  const shownId =
    examsQuestionId(slug) ??
    valueOf(router.query.question) ??
    (slug.length ? undefined : initialQuestion?.id);
  const paperId =
    place.kind === 'paper'
      ? refs.find((ref) => ref.subject === place.subject && ref.year === place.year)?.id
      : undefined;
  // A static page reads its query after hydration; asking earlier fetches the wrong paper.
  const currentId = router.isReady ? (shownId ?? paperId) : undefined;
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

  // Only a question that is on screen has a neighbour a reader can cross into.
  const shownQuestionId = router.isReady ? shownId : undefined;
  useEffect(() => {
    if (!shownQuestionId) return;
    const position = refs.findIndex((ref) => ref.id === shownQuestionId);
    const current = parseQuestionId(shownQuestionId);
    if (position < 0 || !current) return;
    for (const neighbour of [refs[position - 1], refs[position + 1]]) {
      if (neighbour?.subject === current.subject && neighbour.year !== current.year) {
        preloadPaper(neighbour.subject, neighbour.year);
      }
    }
  }, [shownQuestionId, refs]);

  return { entries, status, retry };
}
