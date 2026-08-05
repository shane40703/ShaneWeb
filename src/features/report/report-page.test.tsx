import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import ReportPage from '@/pages/report';

vi.mock('next/router', () => ({
  useRouter: () => ({ query: {} }),
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({ dispatch: vi.fn() }),
}));

afterEach(cleanup);

describe('ReportPage', () => {
  it('starts directly with the report form without a duplicate title panel', () => {
    render(
      <ToastProvider>
        <ReportPage />
      </ToastProvider>,
    );

    expect(
      screen.queryByRole('heading', { name: '問題回報' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('問題類型')).toBeInTheDocument();
    expect(screen.getByLabelText('問題說明')).toBeInTheDocument();
  });
});
