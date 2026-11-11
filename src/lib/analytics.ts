import { readStoredValue, writeStoredValue } from '@/lib/storage';
import type { SubjectId } from '@/lib/types';

/**
 * Google Analytics, and the only file that knows about gtag. Nothing here may carry
 * an account, a question, an answer or a score: events take fixed names and the
 * subject, and every page URL is reduced to its path before it is sent.
 * Events and their GA settings are recorded in GOOGLE_ANALYTICS.md; keep it in step.
 */
export type PracticeEvent =
  | 'question_answered'
  | 'answer_revealed'
  | 'practice_start'
  | 'practice_complete'
  | 'paper_download';

export type PracticeMode =
  | 'daily_quiz'
  | 'mock_exam'
  | 'law_cloze'
  | 'paper'
  | 'exams'
  | 'wrong_retry'
  | 'difficult_retry';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const OPT_OUT_STORAGE_KEY = 'shaneweb:ga-opt-out';
const EXAMS_PATH = '/exams';
const EXAMS_TITLE = '歷屆試題（討論版）｜建築師考試';

const practiceAreas: Record<PracticeMode, 'daily' | 'exams' | 'review'> = {
  daily_quiz: 'daily',
  mock_exam: 'daily',
  law_cloze: 'daily',
  paper: 'daily',
  exams: 'exams',
  wrong_retry: 'review',
  difficult_retry: 'review',
};

let measurementId: string | null | undefined;
let lastPath: string | undefined;
let lastLocation: string | undefined;

type GtagParameters = Record<string, string | boolean>;

function gtag(command: 'js', date: Date): void;
function gtag(command: 'set', parameters: GtagParameters): void;
function gtag(command: 'config', id: string, parameters: GtagParameters): void;
function gtag(command: 'event', name: string, parameters?: GtagParameters): void;
function gtag() {
  // gtag.js only reads Arguments objects from the queue, not arrays.
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

/** `?ga=off` or `?ga=on` is the owner's switch; one visit decides until the other is used. */
function optedOut() {
  const choice = new URLSearchParams(window.location.search).get('ga');
  if (choice !== 'off' && choice !== 'on') {
    return readStoredValue(OPT_OUT_STORAGE_KEY) === 'off';
  }
  writeStoredValue(OPT_OUT_STORAGE_KEY, choice);
  return choice === 'off';
}

export function analyticsMeasurementId() {
  if (measurementId === undefined) {
    const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    // Read the switch first: ?ga=off is remembered even before an ID is deployed.
    const off = optedOut();
    measurementId = id && !off ? id : null;
  }
  return measurementId ?? undefined;
}

/**
 * Each question has its own address for search engines. GA still sees 歷屆試題（討論版） as one page,
 * so changing question is no page view and no 題號 reaches it through a URL or a title.
 */
function reportedPath(path: string) {
  return path.startsWith(`${EXAMS_PATH}/`) ? EXAMS_PATH : path;
}

/** The URL GA may see: campaign parameters survive, ?question=, ?q= and ?result= do not. */
function pageLocation(href: string) {
  const url = new URL(href);
  const campaign = [...url.searchParams].filter(([name]) => name.startsWith('utm_'));
  const query = new URLSearchParams(campaign).toString();
  return `${url.origin}${reportedPath(url.pathname)}${query ? `?${query}` : ''}`;
}

/** A full load from one of our pages: the browser would hand GA that page's whole URL. */
function internalReferrer() {
  const { referrer } = document;
  return referrer.startsWith(`${window.location.origin}/`)
    ? pageLocation(referrer)
    : undefined;
}

export function trackPageView(fullPath: string) {
  const id = analyticsMeasurementId();
  const path = reportedPath(fullPath);
  if (!id || path === lastPath) return;
  const location = pageLocation(window.location.href);
  const referrer = lastLocation ?? internalReferrer();
  if (!lastPath) gtag('js', new Date());
  // Set globally, not on the event: GA's own events read the real URL otherwise.
  // An external first referrer stays the browser's: it is where the visit came from.
  gtag('set', {
    page_location: location,
    page_title: path === EXAMS_PATH ? EXAMS_TITLE : document.title,
    ...(referrer ? { page_referrer: referrer } : {}),
  });
  if (!lastPath) {
    gtag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }
  gtag('event', 'page_view');
  lastPath = path;
  lastLocation = location;
}

/** The mode of a 每日抽題練習 set, which 整組重練 reuses for its marked questions. */
export function quizPracticeMode(reviewSource?: 'difficult' | 'wrong'): PracticeMode {
  if (reviewSource === 'wrong') return 'wrong_retry';
  return reviewSource === 'difficult' ? 'difficult_retry' : 'daily_quiz';
}

/** Does nothing until a page view is queued: no ID, opted out, tests and Storybook. */
export function trackPractice(
  event: PracticeEvent,
  mode: PracticeMode,
  subject: SubjectId,
) {
  if (!lastPath) return;
  gtag('event', event, {
    practice_area: practiceAreas[mode],
    practice_mode: mode,
    subject,
  });
}
