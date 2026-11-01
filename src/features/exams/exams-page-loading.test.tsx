import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncProvider } from '@/components/cloud-sync-provider';
import { ToastProvider } from '@/components/ui/ui';
import { ExamsPage } from '@/features/exams/exams-page';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { STORAGE_KEY } from '@/lib/study';
import type { Question } from '@/lib/types';
import type { QuestionEntry, QuestionRef } from '@/question-bank/derived-data';
import { AppStateProvider } from '@/state/app-state';

const router = vi.hoisted(() => ({
  isReady: true,
  query: {} as Record<string, string | string[] | undefined>,
  replace: vi.fn(),
}));
vi.mock('next/router', () => ({ useRouter: () => router }));

/** The last question of a paper, and the first of the next one, which has not downloaded. */
const shown: Question = {
  id: 'law-114-80',
  subject: 'law',
  year: 114,
  questionNumber: 80,
  format: 'multiple-choice',
  topic: '建築法',
  primaryCategory: '建築法',
  tags: [],
  text: '已下載的題目',
  content: [{ kind: 'text', text: '已下載的題目' }],
  options: ['甲', '乙', '丙', '丁'],
  answerKey: { kind: 'accepted', options: [0] },
  source: { kind: 'sample' },
};
const next: QuestionRef = {
  id: 'law-113-01',
  subject: 'law',
  year: 113,
  questionNumber: 1,
  format: 'multiple-choice',
};
const nextBody: Question = {
  ...shown,
  ...next,
  text: '下一卷的題目',
  content: [{ kind: 'text', text: '下一卷的題目' }],
};

function page(
  status: QuestionBankStatus,
  questions: readonly QuestionEntry[],
  onRetry?: () => void,
) {
  return (
    <ToastProvider>
      <AppStateProvider>
        <CloudSyncProvider>
          <ExamsPage
            questions={questions}
            questionBankStatus={status}
            onRetryQuestionBank={onRetry}
          />
        </CloudSyncProvider>
      </AppStateProvider>
    </ToastProvider>
  );
}

/** Opens the shown question, then moves on while the next paper is not here. */
function crossPapers(status: QuestionBankStatus, onRetry?: () => void, tab?: string) {
  const query = tab ? { tab } : {};
  router.query = { question: shown.id, ...query };
  const view = render(page('ready', [shown, next]));
  router.query = { question: next.id, ...query };
  view.rerender(page(status, [shown, next], onRetry));
  return view;
}

describe('ExamsPage while another paper downloads', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '');
    window.localStorage.clear();
    router.isReady = true;
    router.replace.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('keeps the tiles and the way forward, and says it is on its way', () => {
    crossPapers('loading');

    expect(screen.getByText('正在載入題目內容…')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /下一題/ }).at(-1)).toBeVisible();
    expect(screen.getAllByText('1 / 1').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('heading', { name: '題庫載入失敗' }),
    ).not.toBeInTheDocument();
  });

  it('offers a retry inside the card when the paper fails, and keeps the page', () => {
    const retry = vi.fn();
    crossPapers('error', retry);

    expect(screen.getByRole('heading', { name: '題目暫時無法顯示' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '題庫載入失敗' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /上一題/ }).at(-1)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows the new question when its paper arrives', () => {
    const view = crossPapers('loading');
    view.rerender(page('ready', [shown, nextBody]));

    expect(screen.getByText('下一卷的題目')).toBeInTheDocument();
    expect(screen.queryByText('正在載入題目內容…')).not.toBeInTheDocument();
  });

  it('still says the question is missing once nothing is on its way', () => {
    crossPapers('ready');

    expect(screen.getByRole('heading', { name: '找不到指定題目' })).toBeInTheDocument();
  });

  it('saves a post of the question in the URL to that question', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        discussionPosts: [
          {
            id: 'post-1',
            questionId: next.id,
            type: 'explanation',
            content: '下一題的討論',
            images: [],
            createdAt: '2026-10-01T00:00:00.000Z',
            likes: 0,
            replies: [],
            reported: false,
          },
        ],
      }),
    );
    crossPapers('loading', undefined, 'discussion');

    const post = (await screen.findByText('下一題的討論')).closest('article');
    fireEvent.click(
      within(post as HTMLElement).getByRole('button', { name: /加入我的筆記/ }),
    );

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
      expect(Object.keys(saved.notes ?? {})).toEqual([next.id]);
    });
  });
});
