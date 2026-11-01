import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ asPath: '/exams' }));
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
});
