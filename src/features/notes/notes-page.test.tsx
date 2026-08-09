import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { NotesPage } from '@/features/notes/notes-page';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
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
const environmentQuestion = question('env-114-01', 'env');

function page(
  props: Partial<React.ComponentProps<typeof NotesPage>> = {},
) {
  return (
    <ToastProvider>
      <AppStateProvider>
        <NotesPage questions={[lawQuestion]} {...props} />
      </AppStateProvider>
    </ToastProvider>
  );
}

afterEach(cleanup);

describe('NotesPage question loading', () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.isReady = true;
    router.query = {};
    router.replace.mockReset();
  });

  it('does not open the wrong editor while a deep link is loading', () => {
    router.query = { question: environmentQuestion.id };

    render(page({ questionBankStatus: 'loading' }));

    expect(
      screen.getByRole('heading', { name: '正在載入題目' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('我的筆記')).not.toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });

  it('requests only the subject referenced by an unresolved deep link', async () => {
    const requestQuestionBank = vi.fn();
    router.query = { question: environmentQuestion.id };

    render(
      page({
        questionBankStatuses: { env: 'idle' },
        onRequestQuestionBank: requestQuestionBank,
      }),
    );

    await waitFor(() => {
      expect(requestQuestionBank).toHaveBeenCalledWith('env');
    });
    expect(
      screen.getByRole('heading', { name: '正在載入題目' }),
    ).toBeInTheDocument();
  });

  it('loads another subject only after the user selects it', async () => {
    const requestQuestionBank = vi.fn();
    const view = render(
      page({
        questionBankStatuses: { env: 'idle' },
        onRequestQuestionBank: requestQuestionBank,
      }),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /建築環境控制/ }),
    );

    expect(requestQuestionBank).toHaveBeenCalledWith('env');
    expect(
      screen.getByRole('heading', { name: '正在載入題目' }),
    ).toBeInTheDocument();

    view.rerender(
      page({
        questions: [lawQuestion, environmentQuestion],
        questionBankStatuses: { env: 'ready' },
        onRequestQuestionBank: requestQuestionBank,
      }),
    );

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        {
          pathname: '/notes',
          query: { question: environmentQuestion.id },
        },
        undefined,
        { shallow: true, scroll: false },
      );
    });
  });

  it('shows a retry action instead of the wrong editor after a load error', () => {
    const retry = vi.fn();
    router.query = { question: environmentQuestion.id };

    render(
      page({
        questionBankStatus: 'error',
        onRetryQuestionBank: retry,
      }),
    );

    expect(
      screen.getByRole('heading', { name: '題庫載入失敗' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('我的筆記')).not.toBeInTheDocument();
  });

  it('does not hide unavailable-subject notes behind the default law editor', () => {
    render(page({ questionBankStatus: 'error' }));

    expect(
      screen.getByRole('heading', { name: '題庫載入失敗' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('我的筆記')).not.toBeInTheDocument();
  });

  it('keeps an unsaved default-question draft when the full bank becomes ready', async () => {
    const view = render(page({ questionBankStatus: 'loading' }));
    const editor = await screen.findByLabelText('我的筆記');
    fireEvent.change(editor, { target: { value: '尚未儲存的草稿' } });

    view.rerender(
      page({
        questions: [lawQuestion, environmentQuestion],
        questionBankStatus: 'ready',
      }),
    );

    expect(screen.getByText('law-114-01 題幹')).toBeInTheDocument();
    expect(screen.queryByText('env-114-01 題幹')).not.toBeInTheDocument();
    expect(screen.getByLabelText('我的筆記')).toHaveValue('尚未儲存的草稿');
  });

  it('places the source above the question without a visible options heading', async () => {
    render(page());

    const source = await screen.findByText('示範題・非完整官方試卷資料');
    const prompt = screen.getByText('law-114-01 題幹');
    expect(source.nextElementSibling).toContainElement(prompt);
    expect(
      screen.queryByRole('heading', { name: '題目選項' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '題目選項' }),
    ).toBeInTheDocument();
  });

  it('keeps an unsaved draft through a bank error and retry', async () => {
    const retry = vi.fn();
    const view = render(page({ questionBankStatus: 'loading' }));
    fireEvent.change(await screen.findByLabelText('我的筆記'), {
      target: { value: '等待重試的草稿' },
    });

    view.rerender(
      page({
        questionBankStatus: 'error',
        onRetryQuestionBank: retry,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();

    view.rerender(
      page({
        questions: [lawQuestion, environmentQuestion],
        questionBankStatus: 'ready',
      }),
    );

    expect(screen.getByLabelText('我的筆記')).toHaveValue('等待重試的草稿');
  });

  it('deletes saved note text and images after confirmation', async () => {
    const state = createDefaultState();
    state.notes[lawQuestion.id] = '要刪除的筆記';
    state.noteImages[lawQuestion.id] = [
      {
        id: 'note-image',
        name: 'note.png',
        type: 'image/png',
        dataUrl: 'data:image/png;base64,dGVzdA==',
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(page());

    expect(await screen.findByLabelText('我的筆記')).toHaveValue('要刪除的筆記');
    fireEvent.click(screen.getByRole('button', { name: '刪除筆記' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '確認刪除' }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText('我的筆記')).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: '刪除筆記' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('尚未儲存任何筆記。')).toBeInTheDocument();
    });
  });

  it('lists only saved notes from the currently selected subject and year', async () => {
    const state = createDefaultState();
    state.notes[lawQuestion.id] = '法規筆記';
    state.notes[environmentQuestion.id] = '環控筆記';
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(page());

    expect(await screen.findByText('114・法規・第 1 題')).toBeInTheDocument();
    expect(screen.queryByText('114・環控・第 1 題')).not.toBeInTheDocument();
  });

  it('shows difficult status on the note question navigator', async () => {
    const state = createDefaultState();
    state.difficultQuestionIds = [lawQuestion.id];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(page());

    expect(
      await screen.findByRole('button', {
        name: '第 1 題（已標記難題）',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('難題')).toBeInTheDocument();
  });
});
