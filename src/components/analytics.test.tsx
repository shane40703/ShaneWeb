import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  asPath: '/exams',
  isReady: true,
  pathname: '/',
  replace: vi.fn(),
}));
vi.mock('next/router', () => ({ useRouter: () => router }));
vi.mock('next/script', () => ({
  default: ({ src, strategy }: { src: string; strategy: string }) => (
    <div data-testid="gtag" data-src={src} data-strategy={strategy} />
  ),
}));

/** Reloaded per test: the ID and the last path sent live in the module for the whole page. */
async function loadAnalytics(id = 'G-TEST123') {
  vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', id);
  vi.resetModules();
  return (await import('./analytics')).Analytics;
}

function pageViews() {
  return (window.dataLayer ?? []).filter((entry) => {
    const [command, name] = Array.from(entry as ArrayLike<unknown>);
    return command === 'event' && name === 'page_view';
  }).length;
}

beforeEach(() => {
  delete window.dataLayer;
  window.localStorage.clear();
  router.asPath = '/exams';
  router.isReady = true;
  router.pathname = '/';
  router.replace.mockReset();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Analytics', () => {
  it('renders nothing and sends nothing without an ID', async () => {
    const Analytics = await loadAnalytics('');

    const { container } = render(<Analytics />);

    expect(container).toBeEmptyDOMElement();
    expect(window.dataLayer).toBeUndefined();
  });

  it('loads gtag.js lazily for the ID and sends the first page view', async () => {
    const Analytics = await loadAnalytics();

    render(<Analytics />);

    const script = screen.getByTestId('gtag');
    expect(script).toHaveAttribute(
      'data-src',
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
    );
    expect(script).toHaveAttribute('data-strategy', 'lazyOnload');
    expect(pageViews()).toBe(1);
  });

  it('sends a page view for a new path but not for a new query', async () => {
    const Analytics = await loadAnalytics();
    const { rerender } = render(<Analytics />);

    router.asPath = '/exams?question=law-114-02';
    rerender(<Analytics />);
    router.asPath = '/exams?question=law-114-03#notes';
    rerender(<Analytics />);
    expect(pageViews()).toBe(1);

    router.asPath = '/practice/quiz';
    rerender(<Analytics />);
    expect(pageViews()).toBe(2);
  });

  it('drops the campaign from the address only after GA has taken it', async () => {
    window.history.replaceState(
      null,
      '',
      '/?utm_source=threads&utm_content=comment&tab=notes#top',
    );
    router.asPath = '/?utm_source=threads&utm_content=comment&tab=notes#top';
    let queuedFirst = '';
    router.replace.mockImplementation(() => {
      queuedFirst = JSON.stringify(
        (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>)),
      );
    });
    const Analytics = await loadAnalytics();

    render(<Analytics />);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/?tab=notes#top', undefined, {
      shallow: true,
      scroll: false,
    });
    expect(queuedFirst).toContain('utm_source=threads&utm_content=comment');
  });

  it('waits for the router, which reads the query after hydration', async () => {
    window.history.replaceState(null, '', '/?utm_source=threads');
    router.isReady = false;
    const Analytics = await loadAnalytics();

    const { rerender } = render(<Analytics />);
    expect(router.replace).not.toHaveBeenCalled();

    router.isReady = true;
    rerender(<Analytics />);
    expect(router.replace).toHaveBeenCalledWith('/', undefined, {
      shallow: true,
      scroll: false,
    });
  });

  it.each([
    ['/exams/[[...slug]]', '/exams/law/114/3?tab=notes&utm_source=threads'],
    ['/practice/quiz', '/practice/quiz?utm_source=threads'],
  ])('leaves every page but the home page alone: %s', async (pathname, address) => {
    window.history.replaceState(null, '', address);
    router.pathname = pathname;
    const Analytics = await loadAnalytics();

    render(<Analytics />);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('leaves an address without a campaign alone', async () => {
    window.history.replaceState(null, '', '/exams/law/114/3?tab=notes');
    const Analytics = await loadAnalytics();

    render(<Analytics />);

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('cleans the address when no ID is set, too', async () => {
    window.history.replaceState(null, '', '/?utm_source=threads');
    const Analytics = await loadAnalytics('');

    render(<Analytics />);

    expect(router.replace).toHaveBeenCalledWith('/', undefined, {
      shallow: true,
      scroll: false,
    });
  });
});
