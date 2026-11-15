import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isCrawlerUserAgent,
  resolveFirebaseAuthDomain,
  resolveFirebaseStorageBucket,
} from '@/lib/firebase-client';

const firebase = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
  getAuth: vi.fn(() => ({ name: 'auth' })),
  getFirestore: vi.fn(() => ({ name: 'db' })),
  setLogLevel: vi.fn(),
  getStorage: vi.fn(() => ({ name: 'storage' })),
}));
vi.mock('firebase/app', () => ({
  initializeApp: firebase.initializeApp,
  getApps: firebase.getApps,
  getApp: firebase.getApp,
}));
vi.mock('firebase/auth', () => ({ getAuth: firebase.getAuth }));
vi.mock('firebase/firestore', () => ({
  getFirestore: firebase.getFirestore,
  setLogLevel: firebase.setLogLevel,
}));
vi.mock('firebase/storage', () => ({ getStorage: firebase.getStorage }));

const crawlers = {
  'Googlebot smartphone':
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Googlebot desktop':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/141.0.7390.122 Safari/537.36',
  'Google-InspectionTool':
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)',
  GoogleOther:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; GoogleOther)',
  'Storebot-Google':
    'Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
  'AdsBot-Google-Mobile':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)',
  'Mediapartners-Google': 'Mediapartners-Google',
  'APIs-Google':
    'APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)',
  'FeedFetcher-Google': 'FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)',
  'Google-Read-Aloud':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)',
  bingbot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  BingPreview:
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534+ (KHTML, like Gecko) BingPreview/1.0b',
  AdIdxBot: 'Mozilla/5.0 (compatible; adidxbot/2.0; +http://www.bing.com/bingbot.htm)',
  msnbot: 'msnbot/2.0b (+http://search.msn.com/msnbot.htm)',
  Applebot:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  DuckDuckBot: 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
  YandexBot: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'Yandex renderer':
    'Mozilla/5.0 (compatible; YandexRenderResourcesBot/1.0; +http://yandex.com/bots)',
  Baiduspider:
    'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)',
  'Sogou spider':
    'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
  'Sogou test spider': 'Sogou-Test-Spider/4.0 (compatible; MSIE 5.5; Windows 98)',
  Bytespider:
    'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
  PetalBot:
    'Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
  SemrushBot:
    'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  AhrefsBot: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  MJ12bot: 'Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)',
  DotBot:
    'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)',
  GPTBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'OAI-SearchBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'ChatGPT-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  ClaudeBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'Claude-User': 'Claude-User/1.0 (Claude-User@anthropic.com)',
  PerplexityBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  CCBot: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  Amazonbot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36',
  facebookexternalhit:
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'meta-externalagent':
    'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  Twitterbot: 'Twitterbot/1.0',
  LinkedInBot:
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  Slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  Discordbot: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  TelegramBot: 'TelegramBot (like TwitterBot)',
  WhatsApp: 'WhatsApp/2.23.20.0 A',
  'Naver Yeti': 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
  SeznamBot:
    'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)',
  Lighthouse:
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  'an unlisted bot with an info page':
    'Mozilla/5.0 (compatible; ExampleCrawler/1.0; +https://example.com/crawler)',
};

const people = {
  'Chrome on a Mac':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  'Safari on an iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'a Home Screen web app':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  'Chrome on Android':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
  Edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  Firefox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
  'Samsung Internet':
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  'HeadlessChrome (Playwright)':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36',
  'LINE on an iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.14.0',
  'LINE on Android':
    'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36 Line/14.21.1/IAB',
  'Facebook on an iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.41.106;FBBV/769634321;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBID/phone;FBLC/zh_TW;FBOP/5;FBRV/0]',
  'Facebook on Android':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/484.0.0.63.83;]',
  Instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.27.82 (iPhone15,2; iOS 18_6; zh_TW; zh-Hant; scale=3.00; 1179x2556; 812345678)',
  'Threads on Android':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 Barcelona 400.0.0.0',
  WeChat:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322c) NetType/WIFI Language/zh_TW',
  'a CUBOT P30 phone':
    'Mozilla/5.0 (Linux; Android 10; CUBOT_P30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36',
  'Sogou Mobile Browser':
    'Mozilla/5.0 (Linux; Android 10; V2001A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 SogouMSE,SogouMobileBrowser/5.22.8',
};

describe('resolveFirebaseAuthDomain', () => {
  it("signs in through the site's own address, where /__/auth/ is forwarded", () => {
    expect(
      resolveFirebaseAuthDomain('project-id.firebaseapp.com', {
        protocol: 'https:',
        host: 'exam-tw.vercel.app',
      }),
    ).toBe('exam-tw.vercel.app');
  });

  it('keeps the configured domain where Firebase cannot build an https address', () => {
    expect(
      resolveFirebaseAuthDomain('project-id.firebaseapp.com', {
        protocol: 'http:',
        host: 'localhost:3000',
      }),
    ).toBe('project-id.firebaseapp.com');
    expect(resolveFirebaseAuthDomain('project-id.firebaseapp.com', undefined)).toBe(
      'project-id.firebaseapp.com',
    );
  });
});

describe('resolveFirebaseStorageBucket', () => {
  it('uses the explicitly configured bucket', () => {
    expect(resolveFirebaseStorageBucket('project-id', 'custom.appspot.com')).toBe(
      'custom.appspot.com',
    );
  });

  it('derives the current Firebase bucket when deployment omitted the variable', () => {
    expect(resolveFirebaseStorageBucket('project-id', undefined)).toBe(
      'project-id.firebasestorage.app',
    );
  });
});

describe('isCrawlerUserAgent', () => {
  it.each(Object.entries(crawlers))('recognises %s', (_name, userAgent) => {
    expect(isCrawlerUserAgent(userAgent)).toBe(true);
    expect(isCrawlerUserAgent(userAgent.toUpperCase())).toBe(true);
  });

  it.each(Object.entries(people))('lets %s through', (_name, userAgent) => {
    expect(isCrawlerUserAgent(userAgent)).toBe(false);
  });

  it('lets the test browser through', () => {
    expect(isCrawlerUserAgent(navigator.userAgent)).toBe(false);
  });
});

describe('getFirebaseServices', () => {
  // A fresh module each time: the services, or their absence, are cached per page load.
  async function load() {
    vi.resetModules();
    return (await import('@/lib/firebase-client')).getFirebaseServices;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'api-key');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'project-id.firebaseapp.com');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'project-id');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'app-id');
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('starts neither Auth, Firestore nor Storage for a crawler, and keeps that answer', async () => {
    const userAgent = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue(crawlers['Googlebot smartphone']);
    const getFirebaseServices = await load();
    expect(getFirebaseServices()).toBeNull();
    userAgent.mockReturnValue(people['Chrome on a Mac']);
    expect(getFirebaseServices()).toBeNull();
    expect(firebase.initializeApp).not.toHaveBeenCalled();
    expect(firebase.getAuth).not.toHaveBeenCalled();
    expect(firebase.getFirestore).not.toHaveBeenCalled();
    expect(firebase.getStorage).not.toHaveBeenCalled();
  });

  it('says whether Firebase runs here without starting it, as a render may ask', async () => {
    const userAgent = vi
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue(people['Chrome on a Mac']);
    vi.resetModules();
    const { firebaseConfigurationAvailable, firebaseRunsHere } =
      await import('@/lib/firebase-client');
    expect(firebaseRunsHere()).toBe(true);

    // Held back for a crawler, while the server-rendered UI still sees Firebase configured.
    userAgent.mockReturnValue(crawlers.bingbot);
    expect(firebaseRunsHere()).toBe(false);
    expect(firebaseConfigurationAvailable()).toBe(true);

    userAgent.mockReturnValue(people['Chrome on a Mac']);
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '');
    expect(firebaseRunsHere()).toBe(false);
    expect(firebase.initializeApp).not.toHaveBeenCalled();
    expect(firebase.getAuth).not.toHaveBeenCalled();
    expect(firebase.getFirestore).not.toHaveBeenCalled();
    expect(firebase.getStorage).not.toHaveBeenCalled();
    expect(firebase.setLogLevel).not.toHaveBeenCalled();
  });

  it('starts Firebase once for people, and as before without a navigator', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      people['HeadlessChrome (Playwright)'],
    );
    const getFirebaseServices = await load();
    const services = getFirebaseServices();
    expect(services).toEqual({
      app: { name: 'app' },
      auth: { name: 'auth' },
      db: { name: 'db' },
      storage: { name: 'storage' },
    });
    expect(getFirebaseServices()).toBe(services);
    expect(firebase.initializeApp).toHaveBeenCalledOnce();

    vi.stubGlobal('navigator', undefined);
    expect((await load())()).not.toBeNull();
    vi.stubGlobal('navigator', {});
    expect((await load())()).not.toBeNull();
    expect(firebase.initializeApp).toHaveBeenCalledTimes(3);
  });

  it('logs Firestore traffic for the session after ?fsdebug=1, until ?fsdebug=0', async () => {
    (await load())();
    expect(firebase.setLogLevel).not.toHaveBeenCalled();

    window.history.replaceState(null, '', '/exams/law/114/3?fsdebug=1');
    (await load())();
    expect(firebase.setLogLevel).toHaveBeenCalledWith('debug');
    expect(sessionStorage.getItem('shaneweb:fsdebug')).toBe('1');

    window.history.replaceState(null, '', '/exams');
    (await load())();
    expect(firebase.setLogLevel).toHaveBeenCalledTimes(2);

    window.history.replaceState(null, '', '/exams?fsdebug=0');
    (await load())();
    expect(firebase.setLogLevel).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('shaneweb:fsdebug')).toBeNull();
  });

  it('still honours ?fsdebug=1 for the page when session storage is blocked', async () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    window.history.replaceState(null, '', '/?fsdebug=1');
    expect((await load())()).not.toBeNull();
    expect(firebase.setLogLevel).toHaveBeenCalledWith('debug');

    window.history.replaceState(null, '', '/');
    expect((await load())()).not.toBeNull();
    expect(firebase.setLogLevel).toHaveBeenCalledOnce();
  });
});
