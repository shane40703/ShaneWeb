import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
      expect(requestQuestionBank).toHaveBeenCalledWith('env', 114);
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

  it('keeps the available default-subject note usable after a partial load error', () => {
    render(page({ questionBankStatus: 'error' }));

    expect(
      screen.queryByRole('heading', { name: '題庫載入失敗' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('我的筆記')).toBeInTheDocument();
  });

  it('keeps an unsaved default-question draft when the full bank becomes ready', async () => {
    const view = render(page({ questionBankStatus: 'loading' }));
    const editor = await screen.findByLabelText<HTMLTextAreaElement>('我的筆記');
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
    const questionNumber = screen.getByRole('heading', { name: '第 1 題' });
    expect(source.nextElementSibling).toBe(questionNumber);
    expect(questionNumber.nextElementSibling).toContainElement(prompt);
    expect(
      screen.queryByRole('heading', { name: '題目選項' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '題目選項' }),
    ).toBeInTheDocument();
    expect(screen.getByText('測試分類')).toBeInTheDocument();
  });

  it('shows similar law questions by precise topic below the note', async () => {
    const current = {
      ...lawQuestion,
      text: '防火區劃的防火門規定',
      content: [{ kind: 'text' as const, text: '防火區劃的防火門規定' }],
    };
    const similar = {
      ...lawQuestion,
      id: 'law-113-02',
      year: 113,
      questionNumber: 2,
      text: '防火牆的防火區劃規定',
      content: [{ kind: 'text' as const, text: '防火牆的防火區劃規定' }],
    };
    render(page({ questions: [current, similar] }));

    const panel = await screen.findByRole('region', { name: '類似題目' });
    expect(panel).toHaveTextContent('防火區劃與防火間隔');
    expect(within(panel).getByRole('link', { name: /113 年・第 2 題/ }))
      .toHaveAttribute('href', '/notes?question=law-113-02');
  });

  it('offers rich formatting without a separate preview', async () => {
    render(page());
    const editor = await screen.findByLabelText<HTMLTextAreaElement>('我的筆記');
    fireEvent.change(editor, { target: { value: '重要法條' } });
    editor.scrollTop = 160;
    editor.setSelectionRange(0, 4);

    fireEvent.click(
      screen.getByRole('button', { name: '切換選取文字的粗體格式' }),
    );

    expect(editor).toHaveValue('**重要法條**');
    await waitFor(() => expect(editor.scrollTop).toBe(160));
    expect(screen.queryByRole('region', { name: '筆記格式預覽' })).not.toBeInTheDocument();
    for (const format of ['斜體', '上標', '下標', '紅字']) {
      expect(screen.getByRole('button', { name: `切換選取文字的${format}格式` })).toBeInTheDocument();
    }

    editor.setSelectionRange(2, 6);
    fireEvent.click(
      screen.getByRole('button', { name: '切換選取文字的粗體格式' }),
    );
    expect(editor).toHaveValue('重要法條');
  });

  it('renders formatting after the note is saved and returns to editing on demand', async () => {
    render(page());
    const editor = await screen.findByLabelText<HTMLTextAreaElement>('我的筆記');
    fireEvent.change(editor, { target: { value: '**重點** _補充_ ^2^ ~3~ !!注意!!' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存筆記' }));

    const result = await screen.findByRole('region', { name: '已儲存筆記內容' });
    expect(within(result).getByText('重點').tagName).toBe('STRONG');
    expect(within(result).getByText('補充').tagName).toBe('EM');
    expect(within(result).getByText('2').tagName).toBe('SUP');
    expect(within(result).getByText('3').tagName).toBe('SUB');
    expect(within(result).getByText('注意')).toHaveClass(/red/);
    expect(screen.queryByLabelText('我的筆記')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '編輯筆記' }));
    expect(await screen.findByLabelText('我的筆記')).toHaveValue(
      '**重點** _補充_ ^2^ ~3~ !!注意!!',
    );
  });

  it('keeps an unsaved draft usable through a partial bank error', async () => {
    const view = render(page({ questionBankStatus: 'loading' }));
    fireEvent.change(await screen.findByLabelText('我的筆記'), {
      target: { value: '等待重試的草稿' },
    });

    view.rerender(
      page({
        questionBankStatus: 'error',
      }),
    );

    expect(screen.queryByRole('heading', { name: '題庫載入失敗' }))
      .not.toBeInTheDocument();
    expect(screen.getByLabelText('我的筆記')).toHaveValue('等待重試的草稿');

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

    expect(await screen.findByRole('region', { name: '已儲存筆記內容' })).toHaveTextContent('要刪除的筆記');
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
