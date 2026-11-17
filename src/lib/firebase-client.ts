import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, setLogLevel, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let services: FirebaseServices | null | undefined;

export function resolveFirebaseStorageBucket(
  projectId: string | undefined,
  configuredBucket: string | undefined,
) {
  return configuredBucket?.trim() || (projectId ? `${projectId}.firebasestorage.app` : undefined);
}

/**
 * Google sign-in runs on this site's own /__/auth/, which next.config.ts forwards to Firebase.
 * The frame that reads the result is then not a third-party one whose storage the browser
 * partitions, which loses every redirect sign-in in Safari and Chrome. Firebase only builds
 * https helper addresses, so plain-http development keeps the configured domain.
 */
export function resolveFirebaseAuthDomain(
  configuredDomain: string | undefined,
  location: Pick<Location, 'protocol' | 'host'> | undefined = typeof window === 'undefined'
    ? undefined
    : window.location,
) {
  return location?.protocol === 'https:' ? location.host : configuredDomain;
}

export function firebaseConfigurationAvailable() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

/**
 * Crawlers that run JavaScript render the sitemap's question pages with no saved state, and
 * firestore.googleapis.com has no robots.txt: each render would pay for fresh listeners and
 * even count as a new announcement reader. No bare "bot": phones such as CUBOT_P30 have it.
 */
const CRAWLER_TOKENS = [
  'googlebot', 'google-inspectiontool', 'googleother', 'storebot-google', 'adsbot-google',
  'mediapartners-google', 'apis-google', 'feedfetcher-google', 'google-read-aloud', 'bingbot',
  'bingpreview', 'adidxbot', 'msnbot', 'applebot', 'duckduckbot', 'yandexbot', 'yandex.com/bots',
  'baiduspider', 'sogou', 'bytespider', 'petalbot', 'semrushbot', 'ahrefsbot', 'mj12bot',
  'dotbot', 'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-user',
  'perplexitybot', 'ccbot', 'amazonbot', 'facebookexternalhit', 'meta-externalagent',
  'twitterbot', 'linkedinbot', 'slackbot', 'discordbot', 'telegrambot', 'whatsapp', 'yeti/',
  'seznambot', 'chrome-lighthouse',
  // A bot's info page, as in "(compatible; ExampleBot/1.0; +https://example.com/bot)".
  '+http',
];
// Sogou's mobile browser and search app are used by people; only its spiders crawl.
const SOGOU_FOR_PEOPLE = /sogou(?=mobilebrowser|mse|search)/g;

export function isCrawlerUserAgent(userAgent: string) {
  const agent = userAgent.toLowerCase().replace(SOGOU_FOR_PEOPLE, '');
  return CRAWLER_TOKENS.some((token) => agent.includes(token));
}

function inCrawler() {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
    && isCrawlerUserAgent(navigator.userAgent);
}

/**
 * Whether getFirebaseServices() starts Firebase here: configured, and not held back for a
 * crawler. It starts nothing itself, so a render may ask. Not part of
 * firebaseConfigurationAvailable(): server-rendered UI depends on that and must still match.
 */
export function firebaseRunsHere() {
  return firebaseConfigurationAvailable() && !inCrawler();
}

const FIRESTORE_DEBUG_KEY = 'shaneweb:fsdebug';

/**
 * ?fsdebug=1 logs every Firestore listen target, resume token and received document to the
 * console for the rest of this tab's session, to measure reads; ?fsdebug=0 turns it off.
 */
function firestoreDebugRequested() {
  if (typeof window === 'undefined') return false;
  const choice = new URLSearchParams(window.location.search).get('fsdebug');
  try {
    if (choice === '1') sessionStorage.setItem(FIRESTORE_DEBUG_KEY, '1');
    if (choice === '0') sessionStorage.removeItem(FIRESTORE_DEBUG_KEY);
    return sessionStorage.getItem(FIRESTORE_DEBUG_KEY) === '1';
  } catch {
    // Blocked storage: the address still switches it on for this page.
    return choice === '1';
  }
}

export function getFirebaseServices(): FirebaseServices | null {
  if (services !== undefined) return services;
  // Before initializeApp, so a crawler never starts Auth, Firestore or Storage.
  if (!firebaseRunsHere()) {
    services = null;
    return services;
  }
  if (firestoreDebugRequested()) setLogLevel('debug');

  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: resolveFirebaseAuthDomain(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: resolveFirebaseStorageBucket(
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        ),
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
  return services;
}
