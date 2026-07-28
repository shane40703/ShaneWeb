import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { CommunityPage } from '@/features/community/community-page';
import type { Question, SubjectId } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';

const router = vi.hoisted(() => ({
  isReady: true,
  query: {} as Record<string, string | string[] | undefined>,
  replace: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

function question(id: string, subject: SubjectId): Question {
  return {
    id,
    subject,
    year: 114,
    questionNumber: 1,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `${id} 題幹`,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: [`${id} A`, `${id} B`, `${id} C`, `${id} D`],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

const lawQuestion = question('law-114-01', 'law');

function renderPage(
  props: Partial<React.ComponentProps<typeof CommunityPage>> = {},
) {
  return render(
    <ToastProvider>
      <AppStateProvider>
        <CommunityPage questions={[lawQuestion]} {...props} />
      </AppStateProvider>
    </ToastProvider>,
  );
}

afterEach(cleanup);

describe('CommunityPage question loading', () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.isReady = true;
    router.query = {};
    router.replace.mockReset();
  });

  it('does not expose a fallback question while a deep link is loading', () => {
    router.query = { question: 'env-114-01' };

    renderPage({ questionBankStatus: 'loading' });

    expect(
      screen.getByRole('heading', { name: '正在載入題目' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '標記為難題' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '匿名送出' }),
    ).not.toBeInTheDocument();
  });

  it('shows a retry action when the requested question fails to load', () => {
    const retry = vi.fn();
    router.query = { question: 'env-114-01' };

    renderPage({
      questionBankStatus: 'error',
      onRetryQuestionBank: retry,
    });

    expect(
      screen.getByRole('heading', { name: '題庫載入失敗' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });

  it('does not silently expose an incomplete bank when another subject fails', () => {
    renderPage({ questionBankStatus: 'error' });

    expect(
      screen.getByRole('heading', { name: '題庫載入失敗' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });

  it('uses a matching prerendered law question while the rest of the bank loads', () => {
    router.query = { question: lawQuestion.id };

    renderPage({ questionBankStatus: 'loading' });

    const prompt = screen.getByText('law-114-01 題幹');
    const source = screen.getByText('示範題・非完整官方試卷資料');
    expect(source.nextElementSibling).toContainElement(prompt);
    expect(
      screen.getByRole('button', { name: '標記為難題' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '正在載入題目' }),
    ).not.toBeInTheDocument();
  });

  it('waits for the router before treating an absent query as the default question', () => {
    router.isReady = false;

    renderPage({ questionBankStatus: 'loading' });

    expect(
      screen.getByRole('heading', { name: '正在載入題目' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });
});
