import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { CloudSyncProvider } from '@/components/cloud-sync-provider';
import { ExamsPage } from '@/features/exams/exams-page';
import { STORAGE_KEY } from '@/lib/study';
import type { Question, SubjectId } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';
import { fillRichEditor, selectRichEditor } from '@/test/rich-editor';

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
const writtenQuestion: Question = {
  ...question('structure-114-written-01', 'structure'),
  format: 'written',
  options: [],
  answerKey: { kind: 'written' },
};

function renderPage(
  props: Partial<React.ComponentProps<typeof ExamsPage>> = {},
) {
  return render(
    <ToastProvider>
      <AppStateProvider>
        <CloudSyncProvider>
          <ExamsPage questions={[lawQuestion]} {...props} />
        </CloudSyncProvider>
      </AppStateProvider>
    </ToastProvider>,
  );
}

afterEach(cleanup);

/** The discussion and note panels sit behind tabs; the 題目 tab is the default. */
function openTab(name: RegExp) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

describe('ExamsPage question loading', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', '');
    window.localStorage.clear();
    router.isReady = true;
    router.query = {};
    router.replace.mockReset();
  });

  it('preserves note-style whitespace when adding and editing explanations', async () => {
    const content = '  第一行\n\n\t第二行 格式重點  對齊\n';
    renderPage();
    openTab(/討論區/);
    const editor = screen.getByLabelText('內容');
    fillRichEditor(editor, content);
    fireEvent.click(screen.getByRole('button', { name: '送出共享投稿' }));
    const displayed = await screen.findByText(/第二行 格式重點/);
    expect(displayed.closest('p')!.textContent).toBe(content);
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    expect(screen.getByLabelText('編輯投稿內容')).toHaveTextContent('格式重點');
    const changed = '  修正第一行\n\n\t下一行  留空\n';
    fillRichEditor(screen.getByLabelText('編輯投稿內容'), changed);
    fireEvent.click(screen.getByRole('button', { name: '儲存修改' }));
    await waitFor(() => expect(screen.queryByLabelText('編輯投稿內容')).not.toBeInTheDocument());
    const edited = await screen.findByText(/修正第一行/);
    expect(edited.closest('p')!.textContent).toBe(changed);
  });

  it('shows the current question category beside its subject and year', () => {
    renderPage();

    expect(screen.getByText('測試分類')).toBeInTheDocument();
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

  it('keeps an available question usable when another subject fails', () => {
    renderPage({ questionBankStatus: 'error' });

    expect(
      screen.queryByRole('heading', { name: '題庫載入失敗' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('law-114-01 題幹')).toBeInTheDocument();
  });

  it('uses a matching prerendered law question while the rest of the bank loads', () => {
    router.query = { question: lawQuestion.id };

    renderPage({ questionBankStatus: 'loading' });

    const prompt = screen.getByText('law-114-01 題幹');
    expect(prompt).toBeInTheDocument();
    expect(screen.getByText('示範題・非完整官方試卷資料')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '標記為難題' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '正在載入題目' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '返回作答頁' }),
    ).not.toBeInTheDocument();
  });

  it('remembers a subject click while its questions are still loading', () => {
    const view = renderPage({ questionBankStatus: 'loading' });

    fireEvent.click(screen.getByRole('button', { name: /建築環境控制/ }));
    expect(screen.getByRole('button', { name: /建築環境控制/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(router.replace).not.toHaveBeenCalled();

    view.rerender(
      <ToastProvider>
        <AppStateProvider>
          <CloudSyncProvider>
            <ExamsPage
              questions={[lawQuestion, environmentQuestion]}
              questionBankStatus="ready"
            />
          </CloudSyncProvider>
        </AppStateProvider>
      </ToastProvider>,
    );

    expect(router.replace).toHaveBeenCalledWith(
      { pathname: '/exams', query: { question: environmentQuestion.id } },
      undefined,
      { shallow: true, scroll: false },
    );
  });

  it('waits for the router before treating an absent query as the default question', () => {
    router.isReady = false;

    renderPage({ questionBankStatus: 'loading' });

    expect(
      screen.getByRole('heading', { name: '正在載入題目' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('law-114-01 題幹')).not.toBeInTheDocument();
  });

  it('keeps local text posting available when Firebase is not configured', async () => {
    renderPage();
    openTab(/討論區/);

    const navigator = screen.getByRole('complementary', {
      name: '詳解討論題號導覽',
    });
    const contentColumn = screen.getByRole('main');
    expect(navigator).not.toHaveTextContent('分享解題觀念');
    expect(contentColumn).toHaveTextContent('共享內容');
    expect(contentColumn).toHaveTextContent('分享解題觀念');

    fillRichEditor(screen.getByLabelText('內容'), '本機備援投稿');
    fireEvent.click(screen.getByRole('button', { name: '送出共享投稿' }));

    expect(await screen.findByText('本機備援投稿')).toBeInTheDocument();
    expect(
      screen.getByText('Firebase 尚未設定，投稿內容僅儲存在這台裝置。'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fillRichEditor(screen.getByLabelText('編輯投稿內容'), '修改後的本機投稿');
    expect(screen.getByLabelText('編輯投稿內容')).toHaveTextContent('修改後的本機投稿');
  });

  it('shows the question number and supports bold formatting in the composer', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '第 1 題' })).toBeInTheDocument();
    openTab(/討論區/);
    const textarea = screen.getByLabelText('內容');
    fillRichEditor(textarea, '粗體內容');
    selectRichEditor(textarea, 0, 4);
    fireEvent.click(
      screen.getByRole('button', { name: '切換投稿選取文字的粗體格式' }),
    );
    expect(textarea.querySelector('strong')).toHaveTextContent('粗體內容');
  });

  it('allows essay discussion without answer choices or difficult marking', () => {
    router.query = { question: writtenQuestion.id };
    renderPage({ questions: [lawQuestion, writtenQuestion] });

    expect(screen.getByRole('heading', { name: '申論第 1 題' })).toBeInTheDocument();
    expect(screen.getByText('申論題')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '題目選項' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '標記為難題' })).not.toBeInTheDocument();
    openTab(/討論區/);
    expect(screen.getByRole('button', { name: '送出共享投稿' })).toBeInTheDocument();
  });

  it('asks for confirmation before reporting a post', async () => {
    const user = userEvent.setup();
    renderPage();
    openTab(/討論區/);
    fillRichEditor(screen.getByLabelText('內容'), '需要檢舉的投稿');
    fireEvent.click(screen.getByRole('button', { name: '送出共享投稿' }));
    await screen.findByText('需要檢舉的投稿');

    await user.click(screen.getByRole('button', { name: '檢舉' }));
    const cancel = await screen.findByRole('alertdialog');
    expect(cancel).toHaveTextContent('檢舉這則內容？');
    await user.click(within(cancel).getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '檢舉' })).toBeEnabled();
    expect(screen.queryByText('已送出檢舉')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '檢舉' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: '確認檢舉' }));
    expect(await screen.findByRole('button', { name: '已檢舉' })).toBeDisabled();
    expect(await screen.findByText('已送出檢舉')).toBeInTheDocument();
  });

  it('keeps the edit actions below the editor', async () => {
    renderPage();
    openTab(/討論區/);
    fillRichEditor(screen.getByLabelText('內容'), '要編輯的投稿');
    fireEvent.click(screen.getByRole('button', { name: '送出共享投稿' }));
    await screen.findByText('要編輯的投稿');

    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    const actions = screen.getByRole('button', { name: '儲存修改' }).parentElement!;
    expect(actions.className).toMatch(/editActions/);
    expect(within(actions).getByRole('button', { name: '取消' })).toBeInTheDocument();
  });

  it('hides the answer until 看解答 and then reveals it with a verdict', () => {
    renderPage();

    expect(screen.getByRole('tablist', { name: '題目分頁' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '題目' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radiogroup', { name: '題目選項' })).toBeInTheDocument();
    expect(document.querySelector('[data-accepted]')).toBeNull();
    expect(screen.queryByText(/正確答案/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '看解答' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '看解答' }));

    const answers = screen.getByRole('region', { name: '題目選項' });
    expect(within(answers).getByRole('listitem', { name: /正確選項 A/ })).toBeInTheDocument();
    const verdict = screen.getByText('正確答案：A').closest('[role="status"]');
    expect(verdict).toHaveFocus();
    expect(verdict).not.toHaveTextContent('你的答案');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '看解答' })).not.toBeInTheDocument();
  });

  it('judges a chosen option, resets, and never saves an answer', async () => {
    renderPage();

    fireEvent.click(screen.getByText('law-114-01 B').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));

    const verdict = screen.getByText('答錯了').closest('[role="status"]');
    expect(verdict).toHaveTextContent('正確答案：A・你的答案：B');
    expect(verdict).toHaveFocus();
    const answers = screen.getByRole('region', { name: '題目選項' });
    expect(within(answers).getByRole('listitem', { name: /你的答案 B/ })).toBeInTheDocument();
    expect(within(answers).getByRole('listitem', { name: /正確選項 A/ })).toBeInTheDocument();
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
      expect(stored.answers ?? {}).toEqual({});
      expect(stored.attempts ?? []).toEqual([]);
    });

    fireEvent.click(screen.getByRole('button', { name: '重新作答' }));
    expect(screen.queryByText(/正確答案/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-accepted]')).toBeNull();
    expect(
      screen.getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false'),
    ).toBe(true);

    fireEvent.click(screen.getByText('law-114-01 A').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));
    expect(screen.getByText('答對了')).toBeInTheDocument();
  });

  it('reveals only the explanation for an essay question', () => {
    router.query = { question: writtenQuestion.id };
    renderPage({ questions: [lawQuestion, writtenQuestion] });

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '詳解' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));

    expect(screen.getByRole('heading', { name: '詳解' })).toBeInTheDocument();
    expect(screen.getByText('目前尚無詳解。')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '題目選項' })).not.toBeInTheDocument();
    expect(screen.queryByText(/正確答案/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起解答' }));
    expect(screen.queryByRole('heading', { name: '詳解' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '看解答' }));
    fireEvent.click(screen.getByRole('button', { name: '到討論區看看' }));
    expect(screen.getByRole('button', { name: '送出共享投稿' })).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith(
      { pathname: '/exams', query: { question: writtenQuestion.id, tab: 'discussion' } },
      undefined,
      { shallow: true, scroll: false },
    );
  });

  it('shows the built-in and shared explanations only after revealing', async () => {
    renderPage({ questions: [{ ...lawQuestion, explanation: '內建詳解內容' }] });
    openTab(/討論區/);
    fillRichEditor(screen.getByLabelText('內容'), '共享的詳解');
    fireEvent.click(screen.getByRole('button', { name: '送出共享投稿' }));
    await screen.findByText('共享的詳解');
    expect(screen.getByRole('tab', { name: /討論區/ })).toHaveTextContent('討論區1');

    openTab(/^題目$/);
    expect(screen.queryByText('內建詳解內容')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '看解答' }));
    expect(screen.getByText('內建詳解內容')).toBeInTheDocument();
    expect(screen.getByText('共享的詳解')).toBeInTheDocument();
    expect(screen.getByText('題目詳解')).toBeInTheDocument();
    expect(screen.queryByText('目前尚無詳解。')).not.toBeInTheDocument();
  });

  it('mirrors the tab into the URL and keeps it when changing question', () => {
    renderPage({
      questions: [lawQuestion, { ...lawQuestion, id: 'law-114-02', questionNumber: 2 }],
    });

    openTab(/討論區/);
    expect(screen.getByRole('tab', { name: /討論區/ })).toHaveAttribute('aria-selected', 'true');
    expect(router.replace).toHaveBeenLastCalledWith(
      { pathname: '/exams', query: { question: lawQuestion.id, tab: 'discussion' } },
      undefined,
      { shallow: true, scroll: false },
    );

    fireEvent.click(
      within(screen.getByRole('group', { name: '題號' })).getByRole('button', { name: '第 2 題' }),
    );
    expect(router.replace).toHaveBeenLastCalledWith(
      { pathname: '/exams', query: { question: 'law-114-02', tab: 'discussion' } },
      undefined,
      { shallow: true, scroll: false },
    );

    openTab(/筆記/);
    expect(router.replace).toHaveBeenLastCalledWith(
      { pathname: '/exams', query: { question: lawQuestion.id, tab: 'notes' } },
      undefined,
      { shallow: true, scroll: false },
    );
    openTab(/^題目$/);
    expect(router.replace).toHaveBeenLastCalledWith(
      { pathname: '/exams', query: { question: lawQuestion.id } },
      undefined,
      { shallow: true, scroll: false },
    );
  });

  it('opens the tab named in the URL', () => {
    router.query = { question: lawQuestion.id, tab: 'notes' };
    renderPage();

    expect(screen.getByRole('tab', { name: '筆記' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('我的筆記')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '看解答' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('內容')).not.toBeInTheDocument();
  });

  it('saves a note from the 筆記 tab into the shared notes', async () => {
    renderPage();
    openTab(/筆記/);

    expect(screen.getByRole('heading', { name: '第 1 題' })).toBeInTheDocument();
    fillRichEditor(screen.getByLabelText('我的筆記'), '討論版裡寫的筆記');
    fireEvent.click(screen.getByRole('button', { name: '儲存筆記' }));

    expect(await screen.findByRole('region', { name: '已儲存筆記內容' })).toHaveTextContent(
      '討論版裡寫的筆記',
    );
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
      expect(stored.notes[lawQuestion.id]).toContain('討論版裡寫的筆記');
    });
    expect(screen.getByRole('tab', { name: '筆記' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '編輯筆記' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刪除筆記' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分享到考古題討論版' })).toBeInTheDocument();
  });
});
