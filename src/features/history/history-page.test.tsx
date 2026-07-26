import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from '@/features/history/history-page';
import { ToastProvider } from '@/components/ui/ui';
import {
  createAttempt,
  createDefaultState,
  STORAGE_KEY,
} from '@/lib/study';
import { loadAllQuestions } from '@/server/question-bank.server';
import { AppStateProvider } from '@/state/app-state';

const questions = await loadAllQuestions();
const paperQuestions = questions
  .filter((question) => question.subject === 'law' && question.year === 114)
  .slice(0, 2);
const environmentQuestions = questions
  .filter((question) => question.subject === 'env')
  .slice(0, 1);

function acceptedAnswer(question: (typeof paperQuestions)[number]) {
  return question.answerKey.kind === 'accepted'
    ? question.answerKey.options[0]
    : 0;
}

describe('HistoryPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('opens a complete answer record for a saved attempt', async () => {
    const attempt = createAttempt({
      mode: 'paper',
      source: paperQuestions,
      answers: Object.fromEntries(
        paperQuestions.map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-25T00:00:00.000Z',
      elapsedSeconds: 60,
    });
    const state = createDefaultState();
    const environmentAttempt = createAttempt({
      mode: 'paper',
      source: environmentQuestions,
      answers: Object.fromEntries(
        environmentQuestions.map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-24T00:00:00.000Z',
      elapsedSeconds: 30,
    });
    state.attempts = [
      { ...attempt, id: 'attempt-second' },
      attempt,
      environmentAttempt,
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage questions={questions} />
        </AppStateProvider>
      </ToastProvider>,
    );

    const subjectFilters = await screen.findByRole('group', {
      name: '已作答紀錄科目分類',
    });
    expect(
      within(subjectFilters).getByRole('button', { name: '全部 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(subjectFilters).getByRole('button', {
        name: '建築環境控制 1',
      }),
    );
    expect(
      screen.getByRole('heading', { name: /建築環境控制/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /建築法規與實務・114 年/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(subjectFilters).getByRole('button', { name: '全部 3' }),
    );

    const summaries = await screen.findAllByText('查看完整作答紀錄（2）');
    fireEvent.click(summaries[0]);

    const lawGroup = screen
      .getByRole('heading', { name: '建築法規與實務・114 年' })
      .closest('article');
    expect(lawGroup).not.toBeNull();
    const environmentGroup = screen
      .getByRole('heading', {
        name: `建築環境控制・${environmentQuestions[0].year} 年`,
      })
      .closest('article');
    expect(environmentGroup).not.toBeNull();
    expect(screen.getByText('共作答 2 次')).toBeInTheDocument();
    ['第 1 次', '第 2 次'].forEach((ordinal) => {
      const attemptSection = within(lawGroup!)
        .getByRole('heading', { name: ordinal })
        .closest('section');
      expect(attemptSection).not.toBeNull();
      expect(within(attemptSection!).getByText('2.50 分')).toBeInTheDocument();
      expect(
        within(attemptSection!).getByText('/ 100.00 分'),
      ).toBeInTheDocument();
    });
    const environmentAttemptSection = within(environmentGroup!)
      .getByRole('heading', { name: '第 1 次' })
      .closest('section');
    expect(environmentAttemptSection).not.toBeNull();
    expect(
      within(environmentAttemptSection!).getByText('1.50 分'),
    ).toBeInTheDocument();
    expect(
      within(environmentAttemptSection!).getByText('/ 60.00 分'),
    ).toBeInTheDocument();
    expect(
      within(lawGroup!).getByRole('button', { name: '清除第 2 次紀錄' }),
    ).toBeInTheDocument();
    expect(
      within(lawGroup!).getAllByRole('button', { name: '再做一次' }),
    ).toHaveLength(1);
    const openedAttempt = summaries[0].parentElement;
    expect(openedAttempt).not.toBeNull();
    const review = within(openedAttempt!).getByRole('region', {
      name: '完整作答紀錄',
    });
    expect(review).toBeInTheDocument();
    expect(within(review).getByText(paperQuestions[0].text)).toBeInTheDocument();
    expect(within(review).getByText(paperQuestions[1].text)).toBeInTheDocument();
  });

  it('keeps local history usable when one subject bank fails to load', async () => {
    const lawAttempt = createAttempt({
      mode: 'paper',
      source: paperQuestions,
      answers: Object.fromEntries(
        paperQuestions.map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-25T00:00:00.000Z',
      elapsedSeconds: 60,
    });
    const environmentAttempt = createAttempt({
      mode: 'paper',
      source: environmentQuestions,
      answers: Object.fromEntries(
        environmentQuestions.map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-24T00:00:00.000Z',
      elapsedSeconds: 30,
    });
    const mixedAttempt = createAttempt({
      mode: 'random',
      source: [...paperQuestions, ...environmentQuestions],
      answers: Object.fromEntries(
        [...paperQuestions, ...environmentQuestions].map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-23T00:00:00.000Z',
      elapsedSeconds: 90,
    });
    const state = createDefaultState();
    state.attempts = [lawAttempt, environmentAttempt, mixedAttempt];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const retry = vi.fn();

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage
            questions={paperQuestions}
            questionBankStatuses={{ env: 'error' }}
            onRetryQuestionBank={retry}
          />
        </AppStateProvider>
      </ToastProvider>,
    );

    const lawGroup = (
      await screen.findByRole('heading', {
        name: '建築法規與實務・114 年',
      })
    ).closest('article');
    const environmentGroup = screen
      .getByRole('heading', {
        name: `建築環境控制・${environmentQuestions[0].year} 年`,
      })
      .closest('article');
    const mixedGroup = screen
      .getByRole('heading', { name: /跨科目練習/ })
      .closest('article');

    expect(lawGroup).not.toBeNull();
    expect(environmentGroup).not.toBeNull();
    expect(mixedGroup).not.toBeNull();
    expect(
      within(lawGroup!).getByText('查看完整作答紀錄（2）'),
    ).toBeInTheDocument();
    expect(within(lawGroup!).getByText('2.50 分')).toBeInTheDocument();
    expect(within(environmentGroup!).getByText('1.50 分')).toBeInTheDocument();
    expect(within(environmentGroup!).getByText('00:00:30')).toBeInTheDocument();
    expect(within(mixedGroup!).getByText('4.00 分')).toBeInTheDocument();
    expect(within(mixedGroup!).getByText('/ 4.00 分')).toBeInTheDocument();
    expect(
      within(environmentGroup!).getByText('尚有 1 題內容暫時無法顯示'),
    ).toBeInTheDocument();
    expect(
      within(environmentGroup!).getByRole('button', {
        name: '清除第 1 次紀錄',
      }),
    ).toBeInTheDocument();
    expect(
      within(environmentGroup!).getByRole('button', { name: '再做一次' }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(environmentGroup!).getByRole('button', {
        name: '重新載入題目',
      }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith('env');
  });

  it('shows each missing subject bank own loading or error state', async () => {
    const lawAttempt = createAttempt({
      mode: 'paper',
      source: paperQuestions,
      answers: {},
      startedAt: '2026-07-25T00:00:00.000Z',
      elapsedSeconds: 10,
    });
    const environmentAttempt = createAttempt({
      mode: 'paper',
      source: environmentQuestions,
      answers: {},
      startedAt: '2026-07-24T00:00:00.000Z',
      elapsedSeconds: 10,
    });
    const state = createDefaultState();
    state.attempts = [lawAttempt, environmentAttempt];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage
            questions={[]}
            questionBankStatuses={{ law: 'loading', env: 'error' }}
          />
        </AppStateProvider>
      </ToastProvider>,
    );

    const lawGroup = (
      await screen.findByRole('heading', {
        name: '建築法規與實務・114 年',
      })
    ).closest('article');
    const environmentGroup = screen
      .getByRole('heading', {
        name: `建築環境控制・${environmentQuestions[0].year} 年`,
      })
      .closest('article');

    expect(
      within(lawGroup!).getByText('尚有 2 題內容載入中'),
    ).toBeInTheDocument();
    expect(
      within(environmentGroup!).getByText('尚有 1 題內容暫時無法顯示'),
    ).toBeInTheDocument();
  });
});
