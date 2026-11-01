import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import type { SubjectFacets } from '@/question-bank/derived-data';

const router = vi.hoisted(() => ({
  isReady: true,
  pathname: '/resources/analysis',
  query: { subject: 'env', year: '110' } as Record<string, string>,
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock('next/router', () => ({ useRouter: () => router }));
vi.mock('@/features/resources/resource-layout', () => ({
  ResourceLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/analysis/detailed-trend-analysis', () => ({
  DetailedTrendAnalysis: () => null,
}));

const facets: Partial<Record<string, SubjectFacets>> = {
  env: { classes: [['熱環境', '熱']], papers: [{ y: 110, k: [0, 0], a: [1, 2] }] },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('考題分析 rows', () => {
  it('stop waiting and name their topic when the stems fail to arrive', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { default: Route } = await import('@/pages/resources/analysis');

    render(
      <ToastProvider>
        <Route facets={facets as never} initialStems={{}} />
      </ToastProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(document.querySelectorAll('strong[aria-busy="true"]')).toHaveLength(0),
    );
  });
});
