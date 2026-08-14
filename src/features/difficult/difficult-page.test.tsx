import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DifficultPage } from '@/features/difficult/difficult-page';
import { ToastProvider } from '@/components/ui/ui';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';

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
) {
  const state = createDefaultState();
  state.difficultQuestionIds = difficultQuestionIds;
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
  });

  it('groups difficult questions by catalog subject, newest year, and question number', async () => {
    renderPage(questions.map((item) => item.id));

    await screen.findByRole('heading', { name: '建築法規與實務' });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['建築法規與實務', '建築環境控制', '建築構造與施工']);

    const lawGroup = screen
      .getByRole('heading', { name: '建築法規與實務' })
      .closest('section');
    expect(lawGroup).not.toBeNull();
    expect(
      within(lawGroup!)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['114 年', '113 年']);

    const newestYear = within(lawGroup!)
      .getByRole('heading', { name: '114 年' })
      .closest('section');
    expect(newestYear).not.toBeNull();
    const prompts = newestYear!.querySelectorAll('[data-compact="true"]');
    expect([...prompts].map((prompt) => prompt.textContent)).toEqual([
      'law-114-01 題幹',
      'law-114-02 題幹',
    ]);

    const filters = screen.getByRole('group', { name: '難題科目分類' });
    expect(within(filters).getByRole('button', { name: '全部 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(
      within(filters).getByRole('button', { name: '建築環境控制 1' }),
    );
    expect(
      screen.getByRole('heading', { name: '建築環境控制' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '建築法規與實務' }),
    ).not.toBeInTheDocument();
  });

  it('marks correct options accessibly and shows only the explanation panel', async () => {
    renderPage(['law-114-01', 'law-113-01']);

    await screen.findByRole('heading', { name: '建築法規與實務' });
    const summaries = screen.getAllByText('查看完整題目與選項');

    fireEvent.click(summaries[0]);
    const explainedQuestion = summaries[0].closest('article');
    expect(explainedQuestion).not.toBeNull();
    expect(
      within(explainedQuestion!).getByRole('listitem', {
        name: '正確選項 B：law-114-01 B',
      }),
    ).toHaveAttribute('data-accepted', 'true');
    expect(
      within(explainedQuestion!).getByRole('region', {
        name: '第 1 題詳解',
      }),
    ).toHaveTextContent('這是第一題的詳解。');
    expect(screen.queryByText('正確答案')).not.toBeInTheDocument();
    expect(screen.queryByText('最佳解')).not.toBeInTheDocument();

    fireEvent.click(summaries[1]);
    const unexplainedQuestion = summaries[1].closest('article');
    expect(unexplainedQuestion).not.toBeNull();
    expect(
      within(unexplainedQuestion!).getByRole('region', {
        name: '第 1 題詳解',
      }),
    ).toHaveTextContent('目前尚無詳解。');

    const noteEditor = within(unexplainedQuestion!).getByRole('textbox');
    fireEvent.change(noteEditor, { target: { value: '難題**詳解**' } });
    const preview = within(unexplainedQuestion!).getByRole('region', {
      name: '第 1 題筆記格式預覽',
    });
    expect(within(preview).getByText('詳解').tagName).toBe('STRONG');
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
      await screen.findByRole('heading', { name: '建築法規與實務' }),
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
