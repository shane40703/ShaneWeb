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
import {
  PRACTICE_SESSION_STORAGE_KEY,
  type PracticeSession,
} from '@/features/practice/practice-session';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: () => router }));

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
    ).toHaveAttribute('href', '/practice/mock-exam?subject=law&year=113');
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
    ).toHaveAttribute('href', '/practice/mock-exam?subject=law&year=104');
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
      mode: 'practice',
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

  describe('records of the new practices', () => {
    // A 每日抽題練習 set across years, two answered (one right, one wrong) and one blank.
    const practiceQuestions = [
      ...questions.filter(
        (question) =>
          question.subject === 'law' &&
          question.year === 105 &&
          question.answerKey.kind === 'accepted',
      ),
    ]
      .slice(0, 2)
      .concat(
        questions
          .filter(
            (question) =>
              question.subject === 'law' &&
              question.year === 112 &&
              question.answerKey.kind === 'accepted',
          )
          .slice(0, 1),
      );
    const practiceAttempt = {
      id: 'attempt-practice',
      mode: 'practice' as const,
      subject: 'law' as const,
      year: null,
      questionIds: practiceQuestions.map((question) => question.id),
      answers: {
        [practiceQuestions[0].id]: acceptedAnswer(practiceQuestions[0]),
        [practiceQuestions[1].id]: wrongAnswer(practiceQuestions[1]),
      },
      startedAt: '2026-10-20T00:00:00.000Z',
      submittedAt: '2026-10-20T00:10:00.000Z',
      elapsedSeconds: 600,
      correctCount: 1,
      wrongCount: 1,
      unansweredCount: 1,
    };

    function renderHistory(attempts: unknown[], bank = questions) {
      const state = createDefaultState();
      state.attempts = attempts as typeof state.attempts;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return render(
        <ToastProvider>
          <AppStateProvider>
            <HistoryPage questions={bank} />
          </AppStateProvider>
        </ToastProvider>,
      );
    }

    beforeEach(() => {
      router.push.mockReset();
    });

    it('shows a 每日抽題練習 record with the result page’s accuracy', async () => {
      renderHistory([practiceAttempt]);

      const group = await screen.findByLabelText('每日抽題練習作答紀錄');
      fireEvent.click(group.querySelector('summary')!);
      const card = within(group)
        .getByRole('heading', { name: '建築法規與實務・每日抽題練習 3 題' })
        .closest('article')!;
      expect(within(card).getByText('每日抽題練習')).toBeInTheDocument();
      expect(within(card).getByText('105–112 年')).toBeInTheDocument();
      expect(within(card).getByText('正確率 50%')).toBeInTheDocument();
      expect(within(card).getByText('答對 1／2 題')).toBeInTheDocument();

      fireEvent.click(within(card).getByRole('button', { name: /查看完整作答紀錄/ }));
      expect(
        within(card).getByText('選項依原試卷順序顯示，可能和作答時的順序不同。'),
      ).toBeInTheDocument();
      // A blank question is 未作答, never 答錯.
      const review = within(card).getByRole('region', { name: '完整作答紀錄' });
      expect(review.querySelectorAll('[data-result="wrong"]')).toHaveLength(1);
      expect(review.querySelectorAll('[data-result="unanswered"]')).toHaveLength(1);
    });

    it('starts the same 每日抽題練習 questions again, asking before replacing a set in progress', async () => {
      const inProgress: PracticeSession = {
        version: 1,
        id: 'current',
        subject: 'env',
        rangeStart: 113,
        rangeEnd: 114,
        category: 'all',
        questionIds: ['env-114-01'],
        optionOrders: {},
        answers: { 'env-114-01': { selected: 0, correct: true } },
        drafts: {},
        eliminated: {},
        elapsedSeconds: {},
        currentIndex: 0,
      };
      window.localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(inProgress));
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      renderHistory([practiceAttempt]);
      const group = await screen.findByLabelText('每日抽題練習作答紀錄');
      fireEvent.click(group.querySelector('summary')!);
      const retry = within(group).getByRole('button', { name: '再做一次' });

      fireEvent.click(retry);
      expect(confirm).toHaveBeenCalledWith(
        '目前的每日抽題練習還沒完成，要放棄並改練這組題目嗎？作答進度會清除。',
      );
      expect(router.push).not.toHaveBeenCalled();
      expect(
        JSON.parse(window.localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)!).id,
      ).toBe('current');

      confirm.mockReturnValueOnce(true);
      fireEvent.click(retry);
      expect(router.push).toHaveBeenCalledWith('/practice/quiz?q=1');
      const session = JSON.parse(
        window.localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)!,
      ) as PracticeSession;
      expect(session).toMatchObject({
        subject: 'law',
        rangeStart: 105,
        rangeEnd: 112,
        questionIds: practiceAttempt.questionIds,
        answers: {},
        currentIndex: 0,
      });
      expect(Object.keys(session.optionOrders)).toEqual(practiceAttempt.questionIds);
      confirm.mockRestore();
    });

    it('stays put and says why when the browser cannot save the new set', async () => {
      const setItem = Storage.prototype.setItem;
      const spy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(function (this: Storage, key: string, value: string) {
          if (key === PRACTICE_SESSION_STORAGE_KEY) {
            throw new DOMException('full', 'QuotaExceededError');
          }
          return setItem.call(this, key, value);
        });
      renderHistory([practiceAttempt]);
      const group = await screen.findByLabelText('每日抽題練習作答紀錄');
      fireEvent.click(group.querySelector('summary')!);
      fireEvent.click(within(group).getByRole('button', { name: '再做一次' }));

      expect(router.push).not.toHaveBeenCalled();
      expect(
        await screen.findByText('瀏覽器無法儲存練習進度，暫時無法開始這組題目。'),
      ).toBeInTheDocument();
      spy.mockRestore();
    });

    it('waits for the set’s questions before starting it again', async () => {
      renderHistory([practiceAttempt], []);
      const group = await screen.findByLabelText('每日抽題練習作答紀錄');
      fireEvent.click(group.querySelector('summary')!);

      const retry = within(group).getByRole('button', { name: '再做一次' });
      expect(retry).toBeDisabled();
      expect(retry).toHaveAccessibleDescription('題目載入完成後才能再做一次');
    });

    it('opens the same paper in the mock exam for a 模擬考 record', async () => {
      const paperAttempt = createAttempt({
        mode: 'paper',
        source: paperQuestions,
        answers: {},
        startedAt: '2026-07-25T00:00:00.000Z',
        elapsedSeconds: 60,
      });
      renderHistory([paperAttempt]);
      const group = await screen.findByLabelText('114 年作答紀錄');
      fireEvent.click(group.querySelector('summary')!);

      expect(within(group).getByText('歷屆試題模擬考')).toBeInTheDocument();
      // Buttons rendered as links keep the button role.
      expect(within(group).getByRole('button', { name: '再做一次' })).toHaveAttribute(
        'href',
        '/practice/mock-exam?subject=law&year=114',
      );
    });

    it('offers both practices before the first record', async () => {
      renderHistory([]);

      expect(await screen.findByRole('heading', { name: '還沒有作答紀錄' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '每日抽題練習' })).toHaveAttribute(
        'href',
        '/practice/quiz',
      );
      expect(screen.getByRole('link', { name: '開始第一份試卷' })).toHaveAttribute(
        'href',
        '/practice/mock-exam',
      );
    });
  });
});
