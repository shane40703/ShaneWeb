import type { NextRouter } from 'next/router';
import { useEffect } from 'react';
import {
  examsAddress,
  examsHref,
  examsPlace,
  examsPlaceSlug,
  examsSlugParts,
  examsTab,
} from '@/lib/question-path';
import {
  readSessionValue,
  readStoredValue,
  removeSessionValue,
  removeStoredValue,
  writeSessionValue,
  writeStoredValue,
} from '@/lib/storage';
import { subjects, years } from '@/question-bank/catalog';

/**
 * The last place a reader saw in 考古題討論版, which the sidebar returns to: the address and
 * its tab, nothing more (no scroll, answers or drafts). It is browsing, not work, so it is
 * kept in neither app state nor the cloud. Each browser tab keeps its own (sessionStorage); a
 * new tab starts from the latest in any tab (localStorage). Blocked or full storage only
 * loses the place, and the sidebar opens `examsStart`.
 */
export const EXAMS_PLACE_KEY = 'shaneweb:exams-place';

/** A first visit opens the newest 法規 paper's first question, as before the board had overviews. */
export const examsStart = examsHref([subjects[0].id, String(years[0]), '1']);

const stores = [
  { read: readSessionValue, write: writeSessionValue, remove: removeSessionValue },
  { read: readStoredValue, write: writeStoredValue, remove: removeStoredValue },
] as const;

/** The path of an address, without its query. */
function pathOf(address: string) {
  const query = address.indexOf('?');
  return query < 0 ? address : address.slice(0, query);
}

/**
 * A stored place as the board writes it, or undefined. Only an address the board itself would
 * give survives: its path must come back unchanged from the place it names (so `/exams/foo`,
 * `/exams/law/114/03` and anything not under /exams fail), and a tab counts only on a question.
 */
export function examsPlaceFrom(value: string | null | undefined) {
  if (!value) return undefined;
  const path = pathOf(value);
  if (path !== '/exams' && !path.startsWith('/exams/')) return undefined;
  const slug = path === '/exams' ? [] : path.slice('/exams/'.length).split('/');
  if (examsHref(examsPlaceSlug(examsPlace(slug))) !== path) return undefined;
  const tab = new URLSearchParams(value.slice(path.length)).get('tab') ?? undefined;
  return examsAddress(slug, examsTab(tab));
}

export function rememberExamsPlace(address: string) {
  for (const store of stores) store.write(EXAMS_PLACE_KEY, address);
}

/** Where the sidebar's 考古題討論版 goes: this tab's place, else this browser's, else the start. */
export function examsReturnHref() {
  for (const store of stores) {
    const place = examsPlaceFrom(store.read(EXAMS_PLACE_KEY));
    if (place) return place;
  }
  return examsStart;
}

/** A place the site no longer has (a later build removed it) is forgotten after its one 404. */
export function forgetExamsPlace(pathname: string) {
  for (const store of stores) {
    const place = store.read(EXAMS_PLACE_KEY);
    if (place !== null && pathOf(place) === pathname) store.remove(EXAMS_PLACE_KEY);
  }
}

/**
 * Remembers every address the board shows, however the reader got there: a full load (a search
 * result, a typed or shared link, the old `?question=` links), a move inside the board, Back and
 * Forward, or the sidebar. Nothing before the router has read the address.
 */
export function useRememberExamsPlace(router: NextRouter) {
  const ready = router.isReady !== false;
  const address = examsAddress(
    examsSlugParts(router.query.slug),
    examsTab(router.query.tab),
  );
  useEffect(() => {
    if (ready) rememberExamsPlace(address);
  }, [ready, address]);
}
