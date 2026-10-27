import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DifficultPage } from '@/features/difficult/difficult-page';
import { ToastProvider } from '@/components/ui/ui';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { DiscussionPost, Question, SubjectId } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';
import { PRACTICE_SESSION_STORAGE_KEY } from '@/features/practice/practice-session';
import { fillRichEditor } from '@/test/rich-editor';

const router = vi.hoisted(() => ({ push: vi.fn(async () => true) }));
vi.mock('next/router', () => ({ useRouter: () => router }));

function question({
  id,
  subject,
  year,
  questionNumber,
  explanation,
}: {
  id: string;
  subject: SubjectId;
  year: number;
  questionNumber: number;
  explanation?: string;
}): Question {
  const text = `${id} 題幹`;

  return {
    id,
    subject,
    year,
    questionNumber,
    explanation,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text,
    content: [{ kind: 'text', text }],
    options: [`${id} A`, `${id} B`, `${id} C`, `${id} D`],
    answerKey: { kind: 'accepted', options: [1] },
    source: { kind: 'sample' },
  };
}

const questions = [
  question({
    id: 'construction-114-02',
    subject: 'construction',
    year: 114,
    questionNumber: 2,
  }),
  question({
    id: 'law-113-01',
    subject: 'law',
    year: 113,
    questionNumber: 1,
  }),
  question({
    id: 'env-112-01',
    subject: 'env',
    year: 112,
    questionNumber: 1,
  }),
  question({
    id: 'law-114-02',
    subject: 'law',
    year: 114,
    questionNumber: 2,
  }),
  question({
    id: 'law-114-01',
    subject: 'law',
    year: 114,
    questionNumber: 1,
    explanation: '這是第一題的詳解。',
  }),
];

function renderPage(
  difficultQuestionIds: string[],
  props: Partial<React.ComponentProps<typeof DifficultPage>> = {},
  discussionPosts: DiscussionPost[] = [],
) {
  const state = createDefaultState();
  state.difficultQuestionIds = difficultQuestionIds;
  state.discussionPosts = discussionPosts;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  return render(
    <ToastProvider>
      <AppStateProvider>
        <DifficultPage questions={questions} {...props} />
      </AppStateProvider>
    </ToastProvider>,
  );
}

afterEach(cleanup);

describe('DifficultPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.push.mockClear();
  });

  it('starts every marked choice question of the selected subject across years', async () => {
    renderPage(questions.map(item => item.id));
    fireEvent.click(await screen.findByRole('button', { name: '練習本科目難題標記' }));
    fireEvent.click(await screen.findByRole('button', { name: '開始練習（3 題）' }));
    const saved = JSON.parse(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)!);
    expect(saved.questionIds).toEqual(['law-114-01', 'law-114-02', 'law-113-01']);
    expect(saved.reviewSource).toBe('difficult');
    expect(saved.answers).toEqual({});
    expect(router.push).toHaveBeenCalledWith('/practice/quiz?q=1');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).difficultQuestionIds).toEqual(questions.map(item => item.id));
  });

  it('filters difficult questions by subject and year above the question list', async () => {
    renderPage(questions.map((item) => item.id));

    await screen.findByRole('heading', { name: '建築法規與實務 · 114 年' });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['建築法規與實務 · 114 年']);

    const lawGroup = screen
      .getByRole('heading', { name: '建築法規與實務 · 114 年' })
      .closest('section');
    expect(lawGroup).not.toBeNull();
    const prompts = lawGroup!.querySelectorAll('[data-compact="true"]');
    expect([...prompts].map((prompt) => prompt.textContent)).toEqual([
      'law-114-01 題幹',
      'law-114-02 題幹',
    ]);

    const filters = screen.getByRole('region', {
      name: '難題科目與年度分類',
    });
    expect(within(filters).getByRole('button', { name: /建築法規與實務/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(filters).getByRole('button', { name: '114 年' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(filters).getByRole('button', { name: /建築結構/ })).toBeDisabled();
    expect(
      screen.getByRole('heading', { name: '建築法規與實務 · 114 年' }),
    ).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: '113 年' }));
    expect(
      screen.getByRole('heading', { name: '建築法規與實務 · 113 年' }),
    ).toBeInTheDocument();
    expect(screen.getByText('law-113-01 題幹')).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();

    expect(
      screen.queryByRole('heading', { name: /建築構造與施工/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(filters).getByRole('button', { name: /建築環境控制/ }),
    );
    expect(
      screen.getByRole('heading', { name: '建築環境控制 · 112 年' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /建築法規與實務/ }),
    ).not.toBeInTheDocument();
  });

  it('retries difficult questions without repeating the prompt', async () => {
    renderPage(['law-114-01', 'law-113-01']);

    await screen.findByRole('heading', { name: '建築法規與實務 · 114 年' });
    const summaries = screen.getAllByText('查看選項、作答與詳解');

    fireEvent.click(summaries[0]);
    const explainedQuestion = summaries[0].closest('article');
    expect(explainedQuestion).not.toBeNull();
    await within(explainedQuestion!).findByRole('region', { name: '第 1 題重新作答' });
    expect(within(explainedQuestion!).getAllByText('law-114-01 題幹')).toHaveLength(1);
    fireEvent.click(within(explainedQuestion!).getByText('law-114-01 B').closest('label')!);
    fireEvent.click(within(explainedQuestion!).getByRole('button', { name: '檢查答案' }));
    expect(within(explainedQuestion!).getByRole('status')).toHaveTextContent(
      '答對了，已掌握這題',
    );
    expect(within(explainedQuestion!).getByRole('status')).toHaveTextContent(
      '標準答案：B',
    );
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
      expect(stored.answers['law-114-01']).toMatchObject({
        selected: 1,
        correct: true,
      });
    });
    fireEvent.click(within(explainedQuestion!).getByRole('button', { name: '重新作答' }));
    expect(within(explainedQuestion!).queryByRole('status')).not.toBeInTheDocument();
    expect(
      within(explainedQuestion!).getByRole('region', {
        name: '第 1 題詳解',
      }),
    ).toHaveTextContent('這是第一題的詳解。');
    expect(screen.queryByText('正確答案')).not.toBeInTheDocument();
    expect(screen.queryByText('最佳解')).not.toBeInTheDocument();

    const filters = screen.getByRole('region', {
      name: '難題科目與年度分類',
    });
    fireEvent.click(within(filters).getByRole('button', { name: '113 年' }));
    const unexplainedSummary = screen.getByText('查看選項、作答與詳解');
    fireEvent.click(unexplainedSummary);
    const unexplainedQuestion = unexplainedSummary.closest('article');
    expect(unexplainedQuestion).not.toBeNull();
    await within(unexplainedQuestion!).findByRole('region', { name: '第 1 題詳解' });
    expect(
      within(unexplainedQuestion!).getByRole('region', {
        name: '第 1 題詳解',
      }),
    ).toHaveTextContent('目前尚無詳解。');

    const noteEditor = within(unexplainedQuestion!).getByRole('textbox');
    fillRichEditor(noteEditor, '難題詳解');
    expect(
      within(unexplainedQuestion!).queryByRole('region', {
        name: '第 1 題筆記格式預覽',
      }),
    ).not.toBeInTheDocument();
    expect(
      within(unexplainedQuestion!).getByRole('button', {
        name: '切換第 1 題選取文字的斜體格式',
      }),
    ).toBeInTheDocument();
  });

  it('loads shared explanations only after expanding and keeps unsaved notes when collapsed', async () => {
    renderPage(['law-113-01'], {}, [{
      id: 'shared-explanation', questionId: 'law-113-01', type: 'explanation', content: '**已分享的詳解**', images: [],
      createdAt: '2026-10-27T00:00:00Z', likes: 0, replies: [], reported: false,
    }]);
    const summary = await screen.findByText('查看選項、作答與詳解');
    expect(screen.queryByText('已分享的詳解')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(summary);
    const explanation = await screen.findByRole('region', { name: '第 1 題詳解' });
    expect(explanation).toHaveTextContent('已分享的詳解');
    expect(within(explanation).queryByText('目前尚無詳解。')).not.toBeInTheDocument();
    const editor = screen.getByRole('textbox');
    fillRichEditor(editor, '尚未儲存的筆記');
    fireEvent.click(summary);
    fireEvent.click(summary);
    expect(screen.getByRole('textbox')).toHaveTextContent('尚未儲存的筆記');
  });

  it('keeps difficult toggling and the empty state', async () => {
    renderPage(['law-114-01']);

    await screen.findAllByText('law-114-01 題幹');
    fireEvent.click(screen.getByRole('button', { name: '取消難題標記' }));

    expect(
      await screen.findByRole('heading', { name: '還沒有標記難題' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });

  it('keeps loaded subjects usable when another subject bank fails', async () => {
    const retry = vi.fn();
    renderPage(['law-114-01', 'env-112-01'], {
      questions: questions.filter((item) => item.subject === 'law'),
      questionBankStatuses: { law: 'ready', env: 'error' },
      onRetryQuestionBank: retry,
    });

    expect(
      await screen.findByRole('heading', { name: '建築法規與實務 · 114 年' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('law-114-01 題幹').length).toBeGreaterThan(0);
    expect(
      screen.getByText('建築環境控制的難題載入失敗'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith('env');
  });

  it('shows a fallback when a stored difficult question no longer exists', async () => {
    renderPage(['law-114-99'], {
      questions: [],
      questionBankStatuses: { law: 'ready' },
    });

    expect(
      await screen.findByRole('heading', {
        name: '難題內容暫時無法顯示',
      }),
    ).toBeInTheDocument();
  });
});
