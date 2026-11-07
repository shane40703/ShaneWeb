import { act, cleanup, render } from '@testing-library/react';
import mitt from 'next/dist/shared/lib/mitt';
import type { NextRouter } from 'next/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMS_PLACE_KEY } from './exams-last-place';
import { ExamsLayout, pushExamsPlace } from './exams-layout';

const router = vi.hoisted(() => ({
  isReady: true,
  pathname: '/exams/[[...slug]]',
  asPath: '/exams/law/114',
  query: {} as Record<string, string | string[] | undefined>,
  push: vi.fn<(...args: unknown[]) => Promise<boolean>>(() => Promise.resolve(true)),
  events: undefined as unknown as ReturnType<typeof mitt>,
}));
vi.mock('next/router', () => ({ useRouter: () => router }));

const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

/** What Next keeps in `history.state` for an entry it made. */
function entry(key: string, as: string, options: Record<string, unknown> = {}) {
  return { __N: true, key, url: '/exams/[[...slug]]', as, options };
}

/** The address Next has rendered: the router's state changes with the new view. */
function at(asPath: string) {
  router.asPath = asPath;
  router.query = { slug: asPath.split('/').slice(2) };
}

function scrolledTo(top: number) {
  Object.defineProperty(window, 'scrollY', { value: top, configurable: true });
}

/** Back or Forward: the browser changes the entry, then fires popstate. */
async function traverse(delta: number, late = false) {
  const popped = new Promise((resolve) =>
    window.addEventListener('popstate', resolve, { once: true }),
  );
  window.history.go(delta);
  await popped;
  // Outside act(): the render Next does then must commit before its routeChangeComplete.
  if (late) await new Promise((resolve) => setTimeout(resolve));
}

/**
 * Next's own popstate listener, there before the page's: it announces the change and renders
 * the entry the browser moved to, which React does before the event is over. `late` renders
 * it in a later task instead.
 */
function listenLikeNext(rerender: () => void, late: boolean) {
  function follow() {
    const { as } = window.history.state;
    act(() => router.events.emit('beforeHistoryChange', as));
    at(as);
    rerender();
    act(() => router.events.emit('routeChangeComplete', as));
  }
  const listener = () => (late ? setTimeout(follow) : follow());
  // Captured, so that it runs first in every engine, as Next's does in Chromium.
  window.addEventListener('popstate', listener, true);
  return () => window.removeEventListener('popstate', listener, true);
}

/** A new tree each time, as Next renders one for every route change. */
const page = () => (
  <ExamsLayout>
    <p>頁面內容</p>
  </ExamsLayout>
);

beforeEach(() => {
  router.events = mitt();
  router.isReady = true;
  router.push.mockClear();
  scrollTo.mockClear();
  scrolledTo(0);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(cleanup);

describe('pushExamsPlace', () => {
  it('opens another level without loading the page, from the top once it shows', async () => {
    let settle!: (moved: boolean) => void;
    router.push.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));

    pushExamsPlace(router as unknown as NextRouter, ['law', '114', '60']);
    // Not asked of Next: it would also scroll to the top on Back to the entry.
    expect(router.push).toHaveBeenCalledWith(
      { pathname: '/exams/[[...slug]]', query: { slug: ['law', '114', '60'] } },
      undefined,
      { shallow: true, scroll: false },
    );
    expect(scrollTo).not.toHaveBeenCalled();

    await act(async () => settle(true));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('leaves the page where it is when the move does not happen', async () => {
    router.push.mockResolvedValueOnce(false);
    pushExamsPlace(router as unknown as NextRouter, []);
    await act(async () => {});
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('opens the tab it is given there', () => {
    pushExamsPlace(router as unknown as NextRouter, ['law', '113', '1'], 'discussion');
    expect(router.push).toHaveBeenCalledWith(
      {
        pathname: '/exams/[[...slug]]',
        query: { slug: ['law', '113', '1'], tab: 'discussion' },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  });
});

describe('ExamsLayout: the place the sidebar returns to', () => {
  const remembered = () => [
    window.sessionStorage.getItem(EXAMS_PLACE_KEY),
    window.localStorage.getItem(EXAMS_PLACE_KEY),
  ];

  it('remembers the address on screen with its tab, and every move after it', () => {
    router.query = { slug: ['law', '114', '37'], tab: 'notes' };
    const view = render(page());
    expect(remembered()).toEqual([
      '/exams/law/114/37?tab=notes',
      '/exams/law/114/37?tab=notes',
    ]);

    router.query = { slug: ['law', '114', '38'], tab: 'notes', utm_source: 'threads' };
    view.rerender(page());
    expect(remembered()).toEqual([
      '/exams/law/114/38?tab=notes',
      '/exams/law/114/38?tab=notes',
    ]);
  });

  it('remembers an overview without a tab', () => {
    router.query = { slug: ['law', '110'], tab: 'notes' };
    render(page());
    expect(remembered()).toEqual(['/exams/law/110', '/exams/law/110']);
  });

  it('writes nothing before the router has read the address', () => {
    router.isReady = false;
    router.query = {};
    const view = render(page());
    expect(remembered()).toEqual([null, null]);

    router.isReady = true;
    router.query = { slug: ['env', '112', 'written-2'], tab: 'discussion' };
    view.rerender(page());
    expect(remembered()).toEqual([
      '/exams/env/112/written-2?tab=discussion',
      '/exams/env/112/written-2?tab=discussion',
    ]);
  });
});

describe('ExamsLayout: Back and Forward', () => {
  it.each([
    ['as Next and React do it, inside the popstate event', false],
    ['when Next renders after the event', true],
  ])('return to where the reader left each entry, %s', async (_, late) => {
    const id = late ? 'late' : 'now';
    window.history.replaceState(entry(`${id}-list`, '/exams/law/114'), '');
    at('/exams/law/114');
    const mounted: { view?: ReturnType<typeof render> } = {};
    const stop = listenLikeNext(() => mounted.view?.rerender(page()), late);
    const view = render(page());
    mounted.view = view;

    // Down the paper's list to question 60, and open it.
    scrolledTo(640);
    act(() => router.events.emit('beforeHistoryChange', '/exams/law/114/60'));
    // Shallow, as Next marks the entries it pushes: Back to it needs no download.
    expect(window.history.state).toMatchObject({
      key: `${id}-list`,
      options: { shallow: true, scroll: false },
    });
    window.history.pushState(
      entry(`${id}-question`, '/exams/law/114/60', { shallow: true, scroll: false }),
      '',
    );
    at('/exams/law/114/60');
    view.rerender(page());
    act(() => router.events.emit('routeChangeComplete', '/exams/law/114/60'));
    expect(scrollTo).not.toHaveBeenCalled();

    // Back to the list from further down the question.
    scrolledTo(300);
    await traverse(-1, late);
    expect(router.asPath).toBe('/exams/law/114');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'instant' });

    // Forward to the question, where it was left.
    scrolledTo(640);
    await traverse(1, late);
    expect(router.asPath).toBe('/exams/law/114/60');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'instant' });

    // 下一題 after that is a move between questions: it keeps the scroll.
    scrollTo.mockClear();
    act(() => router.events.emit('beforeHistoryChange', '/exams/law/114/61'));
    window.history.replaceState(
      entry(`${id}-question`, '/exams/law/114/61', { shallow: true, scroll: false }),
      '',
    );
    at('/exams/law/114/61');
    view.rerender(page());
    expect(scrollTo).not.toHaveBeenCalled();

    // Back again: the list still has its own place, not the one it was shown at.
    scrolledTo(300);
    await traverse(-1, late);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'instant' });
    stop();
  });

  it('keeps the scroll for a move between questions', () => {
    window.history.replaceState(
      entry('reading', '/exams/law/114/3', { shallow: true, scroll: false }),
      '',
    );
    at('/exams/law/114/3');
    const view = render(page());

    scrolledTo(200);
    act(() => router.events.emit('beforeHistoryChange', '/exams/law/114/4'));
    window.history.replaceState(
      entry('reading', '/exams/law/114/4', { shallow: true, scroll: false }),
      '',
    );
    at('/exams/law/114/4');
    view.rerender(page());

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('returns to the place on Back from another page', () => {
    window.history.replaceState(entry('left', '/exams/env'), '');
    at('/exams/env');
    const view = render(page());
    scrolledTo(480);
    act(() => router.events.emit('beforeHistoryChange', '/practice'));
    view.unmount();
    expect(scrollTo).not.toHaveBeenCalled();

    // Back: the entry is current again when the page renders.
    scrolledTo(0);
    render(page());
    expect(scrollTo).toHaveBeenCalledWith({ top: 480, behavior: 'instant' });
  });
});
