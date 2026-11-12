import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeMode } from './analytics';

const ID = 'G-TEST123';
const OPT_OUT_KEY = 'shaneweb:ga-opt-out';

/** A fresh page load: the module keeps its ID and last path for the life of the page. */
async function load(id = ID) {
  vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', id);
  vi.resetModules();
  return import('./analytics');
}

function visit(url: string) {
  window.history.replaceState(null, '', url);
}

/** The queue as arrays, the way the entries read when gtag.js takes them. */
function queue() {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function location(url: string) {
  return `${window.location.origin}${url}`;
}

function referFrom(url: string) {
  vi.spyOn(Document.prototype, 'referrer', 'get').mockReturnValue(url);
}

beforeEach(() => {
  delete window.dataLayer;
  window.localStorage.clear();
  document.title = '歷屆試題討論版｜建築師考試';
  visit('/');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('page views', () => {
  it('queues nothing without a measurement ID', async () => {
    const { analyticsMeasurementId, trackPageView, trackPractice } = await load('');

    trackPageView('/exams');
    trackPractice('practice_start', 'daily_quiz', 'law');

    expect(analyticsMeasurementId()).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
  });

  it('queues Arguments objects, the only form gtag.js reads', async () => {
    const { trackPageView, trackPractice } = await load();

    trackPageView('/exams');
    trackPractice('answer_revealed', 'exams', 'law');

    expect(window.dataLayer).toHaveLength(5);
    for (const entry of window.dataLayer!) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    }
  });

  it('configures once, without Google signals, and sends its own first page view', async () => {
    const { trackPageView } = await load();
    visit('/exams');

    trackPageView('/exams');

    expect(queue()).toEqual([
      ['js', expect.any(Date)],
      [
        'set',
        {
          page_location: location('/exams'),
          page_title: '歷屆試題討論版｜建築師考試',
        },
      ],
      [
        'config',
        ID,
        {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        },
      ],
      ['event', 'page_view'],
    ]);
  });

  it('keeps campaign parameters and drops every other parameter and the hash', async () => {
    const { trackPageView } = await load();
    visit(
      '/exams?question=law-114-01&utm_source=threads&q=3&result=abc&ga=on&utm_campaign=exam#note',
    );

    trackPageView('/exams');

    expect(queue()[1][1]).toMatchObject({
      page_location: location('/exams?utm_source=threads&utm_campaign=exam'),
    });
  });

  it('skips the path it already sent and refers the next page to the clean location', async () => {
    const { trackPageView } = await load();
    visit('/exams?question=law-114-01&utm_source=threads');
    trackPageView('/exams');

    visit('/exams?question=law-114-02');
    trackPageView('/exams');
    expect(queue()).toHaveLength(4);

    document.title = '每日抽題練習｜建築師考試';
    visit('/practice/quiz?q=2');
    trackPageView('/practice/quiz');

    expect(queue().slice(4)).toEqual([
      [
        'set',
        {
          page_location: location('/practice/quiz'),
          page_title: '每日抽題練習｜建築師考試',
          page_referrer: location('/exams?utm_source=threads'),
        },
      ],
      ['event', 'page_view'],
    ]);
  });

  it('cleans a first referrer from this site, which the browser gives in full', async () => {
    referFrom(location('/exams?question=law-114-01&q=3&result=abc&ga=off#note'));
    const { trackPageView } = await load();
    visit('/privacy');

    trackPageView('/privacy');

    expect(queue()[1][1]).toMatchObject({
      page_location: location('/privacy'),
      page_referrer: location('/exams'),
    });
  });

  it('keeps the campaign of a first referrer from this site', async () => {
    referFrom(location('/?utm_source=threads&q=3'));
    const { trackPageView } = await load();

    trackPageView('/exams');

    expect(queue()[1][1]).toMatchObject({
      page_referrer: location('/?utm_source=threads'),
    });
  });

  it.each(['', 'https://www.threads.net/@someone?igshid=1', 'not a url'])(
    'leaves the first referrer %j to the browser',
    async (referrer) => {
      referFrom(referrer);
      const { trackPageView } = await load();

      trackPageView('/exams');

      expect(queue()[1][1]).not.toHaveProperty('page_referrer');
    },
  );

  it('reports every question address as 歷屆試題討論版, with no 題號 in the URL or title', async () => {
    document.title = '114 年營建法規與實務考古題第 3 題｜建築師考試';
    visit('/exams/law/114/3?utm_source=line');
    const { trackPageView } = await load();

    trackPageView('/exams/law/114/3');

    expect(queue()).toContainEqual([
      'set',
      {
        page_location: location('/exams?utm_source=line'),
        page_title: '歷屆試題討論版｜建築師考試',
      },
    ]);
    expect(JSON.stringify(queue())).not.toContain('114');
  });

  it('does not count another question as a page view', async () => {
    visit('/exams/law/114/3');
    const { trackPageView } = await load();

    trackPageView('/exams/law/114/3');
    visit('/exams/law/114/4');
    trackPageView('/exams/law/114/4');
    trackPageView('/exams/law/113');

    expect(queue().filter(([, name]) => name === 'page_view')).toHaveLength(1);
  });

  it('cleans the question out of a first referrer from this site', async () => {
    referFrom(location('/exams/law/114/3?tab=notes'));
    visit('/practice');
    const { trackPageView } = await load();

    trackPageView('/practice');

    expect(JSON.stringify(queue())).toContain(`"page_referrer":"${location('/exams')}"`);
  });

  it('uses the previous page, not the browser, once a page view has been sent', async () => {
    referFrom('https://www.threads.net/');
    const { trackPageView } = await load();
    trackPageView('/');

    visit('/exams');
    trackPageView('/exams');

    expect(queue().at(-2)?.[1]).toMatchObject({ page_referrer: location('/') });
  });
});

describe('practice events', () => {
  it('does nothing before a page view is queued', async () => {
    const { trackPractice } = await load();

    trackPractice('practice_start', 'daily_quiz', 'law');

    expect(window.dataLayer).toBeUndefined();
  });

  it.each<[PracticeMode, string]>([
    ['daily_quiz', 'daily'],
    ['mock_exam', 'daily'],
    ['law_cloze', 'daily'],
    ['paper', 'daily'],
    ['exams', 'exams'],
    ['wrong_retry', 'review'],
    ['difficult_retry', 'review'],
  ])('sends %s in the %s area', async (mode, area) => {
    const { trackPageView, trackPractice } = await load();
    trackPageView('/exams');

    trackPractice('question_answered', mode, 'env');

    expect(queue().at(-1)).toEqual([
      'event',
      'question_answered',
      { practice_area: area, practice_mode: mode, subject: 'env' },
    ]);
  });

  it('names the mode of a quiz set by where its questions came from', async () => {
    const { quizPracticeMode } = await load();

    expect(quizPracticeMode()).toBe('daily_quiz');
    expect(quizPracticeMode('wrong')).toBe('wrong_retry');
    expect(quizPracticeMode('difficult')).toBe('difficult_retry');
  });
});

describe('opting out', () => {
  it('remembers ?ga=off on later visits', async () => {
    visit('/?ga=off');
    const { analyticsMeasurementId } = await load();
    expect(analyticsMeasurementId()).toBeUndefined();

    visit('/exams');
    expect((await load()).analyticsMeasurementId()).toBeUndefined();
  });

  it('remembers ?ga=off set before an ID is deployed', async () => {
    visit('/?ga=off');
    expect((await load('')).analyticsMeasurementId()).toBeUndefined();
    expect(window.localStorage.getItem(OPT_OUT_KEY)).toBe('off');

    visit('/exams');
    expect((await load()).analyticsMeasurementId()).toBeUndefined();
  });

  it('lets ?ga=on override a stored off, and remembers that too', async () => {
    window.localStorage.setItem(OPT_OUT_KEY, 'off');
    visit('/?ga=on');
    expect((await load()).analyticsMeasurementId()).toBe(ID);

    visit('/exams');
    expect((await load()).analyticsMeasurementId()).toBe(ID);
  });

  it.each(['1', 'false', 'OFF', ''])(
    'ignores ?ga=%s and keeps a stored off',
    async (value) => {
      window.localStorage.setItem(OPT_OUT_KEY, 'off');
      visit(`/?ga=${value}`);

      expect((await load()).analyticsMeasurementId()).toBeUndefined();
      expect(window.localStorage.getItem(OPT_OUT_KEY)).toBe('off');
    },
  );

  it('stores nothing for an unrelated value of ga', async () => {
    visit('/?ga=1');

    expect((await load()).analyticsMeasurementId()).toBe(ID);
    expect(window.localStorage.getItem(OPT_OUT_KEY)).toBeNull();
  });

  it('honours ?ga=off for this page even when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    visit('/?ga=off');

    expect((await load()).analyticsMeasurementId()).toBeUndefined();
  });

  it('still measures when storage cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect((await load()).analyticsMeasurementId()).toBe(ID);
  });

  it('decides once per page load', async () => {
    const { analyticsMeasurementId } = await load();
    expect(analyticsMeasurementId()).toBe(ID);

    visit('/?ga=off');

    expect(analyticsMeasurementId()).toBe(ID);
  });

  it('queues nothing for an opted-out browser', async () => {
    visit('/?ga=off');
    const { trackPageView, trackPractice } = await load();

    trackPageView('/');
    trackPractice('practice_start', 'daily_quiz', 'law');

    expect(window.dataLayer).toBeUndefined();
  });
});
