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
  getQuestionDisplayCategory,
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
const crossYearQuestionGroups = new Map<string, typeof questions>();
questions
  .filter(
    (question) =>
      question.subject === 'env' && question.answerKey.kind === 'accepted',
  )
  .forEach((question) => {
    const category = getQuestionDisplayCategory(question);
    crossYearQuestionGroups.set(category, [
      ...(crossYearQuestionGroups.get(category) ?? []),
      question,
    ]);
  });
const crossYearQuestions =
  (
    [...crossYearQuestionGroups.values()]
      .map((entries) => [
        entries[0],
        entries.find((question) => question.year !== entries[0]?.year),
      ])
      .find((entries) => entries.every(Boolean)) ?? []
  ).filter(
    (question): question is (typeof questions)[number] => Boolean(question),
  );

function acceptedAnswer(question: (typeof paperQuestions)[number]) {
  return question.answerKey.kind === 'accepted'
    ? question.answerKey.options[0]
    : 0;
}

function wrongAnswer(question: (typeof questions)[number]) {
  if (question.answerKey.kind !== 'accepted') return 0;
  const acceptedOptions = question.answerKey.options;
  return question.options.findIndex(
    (_, index) => !acceptedOptions.includes(index),
  );
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
    const lawYearGroup = screen.getByLabelText('114 年作答紀錄');
    const lawYearAttemptCount = state.attempts.filter(
      (savedAttempt) => savedAttempt.subject === 'law' && savedAttempt.year === 114,
    ).length;
    expect(lawYearGroup).not.toHaveAttribute('open');
    within(lawYearGroup)
      .getAllByText('2.50 分')
      .forEach((score) => expect(score).not.toBeVisible());
    expect(
      within(lawYearGroup.querySelector('summary')!).getByText(
        `共作答 ${lawYearAttemptCount} 次`,
      ),
    ).toBeVisible();
    fireEvent.click(within(lawYearGroup).getByText('114 年', { selector: 'strong' }));
    expect(lawYearGroup).toHaveAttribute('open');
    within(lawYearGroup)
      .getAllByText('2.50 分')
      .forEach((score) => expect(score).toBeVisible());
    expect(
      within(subjectFilters).getByRole('button', { name: '建築法規與實務 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(subjectFilters).queryByRole('button', { name: /全部/ }),
    ).not.toBeInTheDocument();
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
    fireEvent.click(within(subjectFilters).getByRole('button', { name: '建築法規與實務 2' }));

    const summaries = await screen.findAllByText('查看完整作答紀錄（2）');
    fireEvent.click(summaries[0]);

    const lawGroup = screen
      .getByRole('heading', { name: '建築法規與實務・114 年' })
      .closest('article');
    expect(lawGroup).not.toBeNull();
    expect(screen.getAllByText('共作答 2 次')).toHaveLength(2);
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
    expect(
      within(lawGroup!).getByRole('button', { name: '清除第 2 次紀錄' }),
    ).toBeInTheDocument();
    expect(
      within(lawGroup!).getAllByRole('button', { name: '再做一次' }),
    ).toHaveLength(1);
    const firstAttemptSection = within(lawGroup!)
      .getByRole('heading', { name: '第 1 次' })
      .closest('section');
    expect(firstAttemptSection).not.toBeNull();
    expect(
      within(firstAttemptSection!).queryByText(/^答對/),
    ).not.toBeInTheDocument();
    expect(
      within(firstAttemptSection!).queryByText(/^答錯/),
    ).not.toBeInTheDocument();
    expect(
      within(firstAttemptSection!).queryByText(/^未答/),
    ).not.toBeInTheDocument();
    expect(
      within(firstAttemptSection!).queryByText(/^時間/),
    ).not.toBeInTheDocument();
    const openedAttempt = summaries[0].closest('section');
    expect(openedAttempt).not.toBeNull();
    const review = within(openedAttempt!).getByRole('region', {
      name: '完整作答紀錄',
    });
    expect(review).toBeInTheDocument();
    expect(within(review).getByText(paperQuestions[0].text)).toBeInTheDocument();
    expect(within(review).getByText(paperQuestions[1].text)).toBeInTheDocument();
    const difficultButtons = within(review).getAllByRole('button', {
      name: '標記為難題',
    });
    expect(difficultButtons).toHaveLength(2);
    fireEvent.click(difficultButtons[0]);
    expect(
      within(review).getByRole('button', { name: '取消難題標記' }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(openedAttempt!).getByRole('button', { name: '收起作答結果' }),
    );
    expect(
      within(openedAttempt!).queryByRole('region', { name: '完整作答紀錄' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /繼續作答 113 年/ }),
    ).toHaveAttribute('href', '/papers?subject=law&year=113');
  });

  it('continues with unattempted catalog years even when only attempted banks are loaded', async () => {
    const state = createDefaultState();
    state.attempts = Array.from({ length: 10 }, (_, index) => 114 - index).map(
      (year) => {
        const question = questions.find(
          (candidate) => candidate.subject === 'law' && candidate.year === year,
        )!;
        return createAttempt({
          mode: 'paper',
          source: [question],
          answers: { [question.id]: acceptedAnswer(question) },
          startedAt: `2026-07-${String(year - 90).padStart(2, '0')}T00:00:00.000Z`,
          elapsedSeconds: 60,
        });
      },
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const loadedQuestion = questions.find(
      (question) => question.subject === 'law' && question.year === 105,
    )!;

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage questions={[loadedQuestion]} />
        </AppStateProvider>
      </ToastProvider>,
    );

    expect(
      await screen.findByRole('button', { name: /繼續作答 104 年/ }),
    ).toHaveAttribute('href', '/papers?subject=law&year=104');
    expect(screen.queryByText('已完成所有年度')).not.toBeInTheDocument();
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
    expect(within(lawGroup!).getByText('查看完整作答紀錄（2）')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '建築環境控制 1' }));
    const environmentGroup = screen
      .getByRole('heading', {
        name: `建築環境控制・${environmentQuestions[0].year} 年`,
      })
      .closest('article');

    expect(lawGroup).not.toBeNull();
    expect(environmentGroup).not.toBeNull();
    expect(within(environmentGroup!).getByText('1.50 分')).toBeInTheDocument();
    expect(within(environmentGroup!).queryByText('00:00:30')).not.toBeInTheDocument();
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

  it('aggregates wrong answers from saved paper attempts across years', async () => {
    expect(crossYearQuestions).toHaveLength(2);
    const attempts = crossYearQuestions.map((question, index) => ({
      ...createAttempt({
        mode: 'paper',
        source: [question],
        answers: { [question.id]: wrongAnswer(question) },
        startedAt: `2026-07-${24 + index}T00:00:00.000Z`,
        elapsedSeconds: 30,
      }),
      id: `cross-year-attempt-${index}`,
      submittedAt: `2026-07-${25 + index}T00:00:00.000Z`,
    }));
    const state = createDefaultState();
    state.attempts = attempts;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage questions={questions} />
        </AppStateProvider>
      </ToastProvider>,
    );

    expect(
      screen.queryByRole('region', { name: '跨年度錯題分析' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('tab', { name: '跨年度錯題分析' }),
    );
    const analysis = await screen.findByRole('region', {
      name: '跨年度錯題分析',
    });
    expect(analysis).toHaveTextContent(`${crossYearQuestions[0].year} 年`);
    expect(analysis).toHaveTextContent(`${crossYearQuestions[1].year} 年`);
    expect(analysis).toHaveTextContent('2 個年度・2 次答錯');
    expect(
      within(analysis).getByRole('tabpanel'),
    ).toHaveTextContent(crossYearQuestions[0].text);
    expect(
      within(analysis).getAllByRole('region', { name: /錯題選項/ }),
    ).toHaveLength(2);

    fireEvent.click(
      screen.getByRole('tab', { name: '每次作答紀錄' }),
    );
    expect(
      screen.queryByRole('region', { name: '跨年度錯題分析' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '錯題類型統計' }),
    ).not.toBeInTheDocument();
    const firstAttemptGroup = screen
      .getByRole('heading', {
        name: `建築環境控制・${crossYearQuestions[0].year} 年`,
      })
      .closest('article');
    expect(firstAttemptGroup).not.toBeNull();
    fireEvent.click(
      within(firstAttemptGroup!).getByRole('button', {
        name: '錯題統計結果',
      }),
    );
    expect(
      screen.getAllByRole('region', { name: '錯題類型統計' }),
    ).toHaveLength(1);
    expect(
      within(firstAttemptGroup!).getByRole('tabpanel', {
        name: '錯題統計結果',
      }),
    ).toHaveTextContent(crossYearQuestions[0].text);
  });

  it('marks a cross-record analysis as partial while another wrong answer loads', async () => {
    const loadedQuestion = paperQuestions[0];
    const loadingQuestion = paperQuestions[1];
    const state = createDefaultState();
    state.attempts = [loadedQuestion, loadingQuestion].map((question, index) => ({
      ...createAttempt({
        mode: 'paper',
        source: [question],
        answers: { [question.id]: wrongAnswer(question) },
        startedAt: `2026-07-${24 + index}T00:00:00.000Z`,
        elapsedSeconds: 30,
      }),
      id: `partial-attempt-${index}`,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage
            questions={[loadedQuestion]}
            questionBankStatuses={{ law: 'loading' }}
          />
        </AppStateProvider>
      </ToastProvider>,
    );

    fireEvent.click(
      await screen.findByRole('tab', { name: '跨年度錯題分析' }),
    );
    expect(
      await screen.findByRole('region', { name: '跨年度錯題分析' }),
    ).toHaveTextContent(loadedQuestion.text);
    expect(screen.getByRole('status')).toHaveTextContent(
      '尚有 1 次答錯內容載入中',
    );
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
    expect(
      within(lawGroup!).getByText('尚有 2 題內容載入中'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '建築環境控制 1' }));
    const environmentGroup = screen
      .getByRole('heading', {
        name: `建築環境控制・${environmentQuestions[0].year} 年`,
      })
      .closest('article');

    expect(
      within(environmentGroup!).getByText('尚有 1 題內容暫時無法顯示'),
    ).toBeInTheDocument();
  });
});
