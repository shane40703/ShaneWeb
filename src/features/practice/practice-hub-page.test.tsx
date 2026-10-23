import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOZE_STORAGE_KEY,
  clozeBank,
  createClozeSession,
  parseClozeSession,
  serializeClozeSession,
  type ClozeSession,
} from '@/features/law-cloze/cloze';
import { writeQuizProgress } from './mock-exam-progress';
import type { QuizAttempt } from '@/lib/types';
import { mockExamScope } from './mock-exam';
import { PracticeHubPage } from './practice-hub-page';
import type { PracticeOverview } from './practice-overview';
import { keepPracticeResult } from './practice-result-memory';
import {
  createPracticeResult,
  PRACTICE_SESSION_STORAGE_KEY,
  type PracticeSession,
} from './practice-session';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: () => router }));

const appState = vi.hoisted(() => ({
  state: { attempts: [] as QuizAttempt[] },
  hydrated: true,
}));
vi.mock('@/state/app-state', () => ({ useAppState: () => appState }));

const overview: PracticeOverview = {
  subjects: [
    { subject: 'law', count: 1183 },
    { subject: 'env', count: 595 },
    { subject: 'construction', count: 1185 },
    { subject: 'structure', count: 0 },
  ],
  cloze: { laws: 10, questions: 358 },
  papers: [
    { subject: 'law', year: 114, questionCount: 80 },
    { subject: 'law', year: 113, questionCount: 80 },
    { subject: 'env', year: 114, questionCount: 40 },
    { subject: 'env', year: 113, questionCount: 40 },
    { subject: 'construction', year: 114, questionCount: 80 },
  ],
};

function practiceSet(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    version: 1,
    id: 'set-1',
    subject: 'law',
    rangeStart: 100,
    rangeEnd: 114,
    category: 'all',
    questionIds: ['law-114-01', 'law-114-02', 'law-114-03', 'law-114-04', 'law-114-05'],
    optionOrders: {},
    answers: {},
    drafts: {},
    eliminated: {},
    elapsedSeconds: {},
    currentIndex: 0,
    ...overrides,
  };
}

function saveSet(session: PracticeSession) {
  window.localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function correctAnswers(id: string) {
  return clozeBank.questions
    .find((question) => question.id === id)!
    .blanks.map((blank) => blank.answer);
}

function saveRound(session: ClozeSession) {
  window.localStorage.setItem(CLOZE_STORAGE_KEY, serializeClozeSession(session));
}

function card(title: string) {
  return screen.getByRole('article', { name: title });
}

beforeEach(() => {
  window.localStorage.clear();
  keepPracticeResult(null);
  appState.state.attempts = [];
  appState.hydrated = true;
  router.push.mockReset().mockResolvedValue(true);
});

afterEach(cleanup);

describe('PracticeHubPage', () => {
  it('leads to all three practices, each titled by a link to its page', () => {
    render(<PracticeHubPage overview={overview} />);

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => [
          heading.textContent,
          within(heading).getByRole('link').getAttribute('href'),
        ]),
    ).toEqual([
      ['選擇題練習', '/practice/quiz'],
      ['法規克漏字', '/practice/law-cloze'],
      ['歷屆試題模擬考', '/practice/mock-exam'],
    ]);
    expect(card('選擇題練習')).toHaveTextContent('4 科・2,963 題');
    expect(card('法規克漏字')).toHaveTextContent('10 部法規・358 題');
    expect(card('歷屆試題模擬考')).toHaveTextContent('3 科・5 份試卷');
  });

  it('waits for the saved progress before showing any shortcut', () => {
    const html = renderToString(<PracticeHubPage overview={overview} />);

    expect(html.match(/正在讀取練習進度…/g)).toHaveLength(3);
    expect(html).not.toContain('選科目開始');
    expect(html).not.toContain('還沒開始');
  });

  it('starts a set from a subject when none is in progress', () => {
    render(<PracticeHubPage overview={overview} />);

    const quiz = card('選擇題練習');
    const law = within(quiz).getByRole('link', { name: /建築法規與實務/ });
    expect(law).toHaveAttribute('href', '/practice/quiz?subject=law');
    expect(law).toHaveTextContent('1,183 題');
    expect(within(quiz).getByRole('link', { name: /建築環境控制/ })).toHaveAttribute(
      'href',
      '/practice/quiz?subject=env',
    );
    // A subject without questions is listed but cannot be opened.
    expect(
      within(quiz).queryByRole('link', { name: /建築結構/ }),
    ).not.toBeInTheDocument();
    expect(within(quiz).getByText('建築結構').parentElement).toHaveTextContent('準備中');
  });

  it('resumes the set in progress at its current question', () => {
    saveSet(
      practiceSet({
        category: '建築法',
        answers: {
          'law-114-01': { selected: 0, correct: true },
          'law-114-02': { selected: 1, correct: false },
        },
        currentIndex: 2,
      }),
    );
    render(<PracticeHubPage overview={overview} />);

    const quiz = card('選擇題練習');
    expect(within(quiz).getByText('進行中的題組')).toBeInTheDocument();
    expect(within(quiz).getByText('法規・建築法・5 題')).toBeInTheDocument();
    expect(within(quiz).getByText('已作答 2／5 題・答對 1 題')).toBeInTheDocument();
    expect(within(quiz).getByRole('link', { name: '繼續第 3 題' })).toHaveAttribute(
      'href',
      '/practice/quiz?q=3',
    );
    expect(within(quiz).queryByText('選科目開始')).not.toBeInTheDocument();
  });

  it('starts a drawn set that has no progress yet from its first question', () => {
    saveSet(practiceSet());
    render(<PracticeHubPage overview={overview} />);

    const quiz = card('選擇題練習');
    expect(within(quiz).getByText('抽好的題組')).toBeInTheDocument();
    expect(within(quiz).getByText('還沒有確認答案')).toBeInTheDocument();
    expect(within(quiz).getByRole('link', { name: '開始作答' })).toHaveAttribute(
      'href',
      '/practice/quiz?q=1',
    );
  });

  it('leads back to the result just submitted, until the set is answered again', () => {
    const answered = practiceSet({
      answers: {
        'law-114-01': { selected: 0, correct: true },
        'law-114-02': { selected: 1, correct: false },
      },
    });
    keepPracticeResult(createPracticeResult(answered));
    saveSet(practiceSet());
    const view = render(<PracticeHubPage overview={overview} />);

    const quiz = card('選擇題練習');
    expect(within(quiz).getByText('剛交卷')).toBeInTheDocument();
    expect(within(quiz).getByText('答對 1／2 題・正確率 50%')).toBeInTheDocument();
    expect(within(quiz).getByRole('link', { name: '看結果' })).toHaveAttribute(
      'href',
      '/practice/quiz?view=result',
    );

    view.unmount();
    saveSet(practiceSet({ drafts: { 'law-114-01': 2 } }));
    render(<PracticeHubPage overview={overview} />);
    expect(within(card('選擇題練習')).queryByText('剛交卷')).not.toBeInTheDocument();
    expect(within(card('選擇題練習')).getByText('進行中的題組')).toBeInTheDocument();
  });

  it('follows a set started in another tab', () => {
    render(<PracticeHubPage overview={overview} />);
    expect(within(card('選擇題練習')).getByText('選科目開始')).toBeInTheDocument();

    act(() => {
      saveSet(practiceSet({ currentIndex: 1, elapsedSeconds: { 'law-114-01': 30 } }));
      window.dispatchEvent(
        new StorageEvent('storage', { key: PRACTICE_SESSION_STORAGE_KEY }),
      );
    });
    expect(
      within(card('選擇題練習')).getByRole('link', { name: '繼續第 2 題' }),
    ).toBeInTheDocument();
  });
});

describe('PracticeHubPage law cloze card', () => {
  it('invites a first round when none is saved', () => {
    render(<PracticeHubPage overview={overview} />);

    const cloze = card('法規克漏字');
    expect(within(cloze).getByText('還沒開始')).toBeInTheDocument();
    expect(within(cloze).getByRole('link', { name: '開始練習' })).toHaveAttribute(
      'href',
      '/practice/law-cloze',
    );
  });

  it('shows the round so far, counting answers that were only revealed', () => {
    const round = createClozeSession({ count: 10 });
    saveRound({
      ...round,
      index: 1,
      results: { [round.order[0]]: correctAnswers(round.order[0]) },
      revealed: [round.order[1]],
    });
    render(<PracticeHubPage overview={overview} />);

    const cloze = card('法規克漏字');
    expect(within(cloze).getByText('已完成 2／10 題・全對 1 題')).toBeInTheDocument();
    expect(within(cloze).getByText('其中 1 題直接看答案，不計分')).toBeInTheDocument();
    expect(within(cloze).getByRole('link', { name: '繼續本輪' })).toHaveAttribute(
      'href',
      '/practice/law-cloze',
    );
  });

  it('offers to continue a round saved before its figures were kept', () => {
    window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(createClozeSession()));
    render(<PracticeHubPage overview={overview} />);

    const cloze = card('法規克漏字');
    expect(
      within(cloze).getByText('上次的練習還保留著，可以接著做。'),
    ).toBeInTheDocument();
    expect(within(cloze).getByRole('link', { name: '繼續練習' })).toBeInTheDocument();
  });

  it('starts the next round with the same settings once the round is complete', async () => {
    const round = createClozeSession({ lawId: 'building-act', count: 5 });
    saveRound({ ...round, index: 4, revealed: [...round.order] });
    render(<PracticeHubPage overview={overview} />);

    const cloze = card('法規克漏字');
    expect(within(cloze).getByText('本輪完成')).toBeInTheDocument();
    expect(within(cloze).getByText('本輪沒有提交作答')).toBeInTheDocument();
    fireEvent.click(within(cloze).getByRole('button', { name: '再練一輪' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/practice/law-cloze'));
    const next = parseClozeSession(window.localStorage.getItem(CLOZE_STORAGE_KEY))!;
    expect(next).toMatchObject({
      lawId: 'building-act',
      count: 5,
      index: 0,
      results: {},
      revealed: [],
    });
    expect(next.order).toHaveLength(5);
    expect(JSON.parse(window.localStorage.getItem(CLOZE_STORAGE_KEY)!).progress).toEqual({
      total: 5,
      submitted: 0,
      correct: 0,
      revealed: 0,
      complete: false,
    });
  });
});

describe('PracticeHubPage mock exam card', () => {
  function paperAttempt(overrides: Partial<QuizAttempt>): QuizAttempt {
    return {
      id: 'attempt',
      mode: 'paper',
      subject: 'law',
      year: 114,
      questionIds: [],
      answers: {},
      startedAt: '2026-10-01T00:00:00.000Z',
      submittedAt: '2026-10-01T01:00:00.000Z',
      elapsedSeconds: 0,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
      ...overrides,
    };
  }

  it('opens a subject’s papers, after the latest submitted result', () => {
    render(<PracticeHubPage overview={overview} />);

    const exam = card('歷屆試題模擬考');
    expect(within(exam).queryByText('最近交卷')).not.toBeInTheDocument();
    expect(within(exam).getByText('選科目開始')).toBeInTheDocument();
    const law = within(exam).getByRole('link', { name: /建築法規與實務/ });
    expect(law).toHaveAttribute('href', '/practice/mock-exam?subject=law');
    expect(law).toHaveTextContent('2 份試卷');
    expect(
      within(exam).queryByRole('link', { name: /建築結構/ }),
    ).not.toBeInTheDocument();
    expect(within(exam).getByText('建築結構').parentElement).toHaveTextContent('準備中');
  });

  it('leads to the latest submitted paper’s result', () => {
    appState.state.attempts = [
      paperAttempt({
        id: 'old',
        correctCount: 40,
        submittedAt: '2026-10-01T00:00:00.000Z',
      }),
      paperAttempt({
        id: 'new',
        year: 113,
        questionIds: Array.from({ length: 80 }, (_, index) => `law-113-${index}`),
        correctCount: 70,
        submittedAt: '2026-10-05T00:00:00.000Z',
      }),
    ];
    render(<PracticeHubPage overview={overview} />);

    const exam = card('歷屆試題模擬考');
    expect(within(exam).getByText('最近交卷')).toBeInTheDocument();
    // The whole row opens the result, named by what it shows.
    const result = within(exam).getByRole('link', { name: /^法規 113 年・87.50 分/ });
    expect(result).toHaveAttribute(
      'href',
      '/practice/mock-exam?subject=law&year=113&result=new',
    );
    expect(result).toHaveTextContent(/答對 70／80 題・.*・看結果$/);
    expect(within(exam).getByText('選科目開始')).toBeInTheDocument();
  });

  it('lists papers in progress, most recent first, each resuming where it stopped', () => {
    writeQuizProgress(mockExamScope('law', 113), {
      'law-113-01': {
        selected: 0,
        elapsedSeconds: 5,
        startedAt: '2026-10-01T00:00:00.000Z',
      },
    });
    writeQuizProgress(mockExamScope('env', 114), {
      'env-114-01': {
        selected: 0,
        elapsedSeconds: 5,
        startedAt: '2026-10-02T00:00:00.000Z',
      },
      'env-114-02': {
        selected: 3,
        elapsedSeconds: 5,
        startedAt: '2026-10-02T00:01:00.000Z',
      },
      'env-114-03': { elapsedSeconds: 5, startedAt: '2026-10-02T00:02:00.000Z' },
    });
    render(<PracticeHubPage overview={overview} />);

    const exam = card('歷屆試題模擬考');
    expect(within(exam).getByText('作答中的試卷')).toBeInTheDocument();
    const rows = within(exam).getAllByRole('link', { name: /已作答/ });
    expect(rows.map((row) => [row.textContent, row.getAttribute('href')])).toEqual([
      ['環控 114 年 已作答 2／40 題', '/practice/mock-exam?subject=env&year=114&q=3'],
      ['法規 113 年 已作答 1／80 題', '/practice/mock-exam?subject=law&year=113&q=2'],
    ]);
    expect(within(exam).queryByText('選科目開始')).not.toBeInTheDocument();
  });

  it('lists at most three drafts and says how many more there are', () => {
    overview.papers.slice(0, 5).forEach(({ subject, year }, index) =>
      writeQuizProgress(mockExamScope(subject, year), {
        [`${subject}-${year}-01`]: {
          selected: 0,
          elapsedSeconds: 1,
          startedAt: `2026-10-0${index + 1}T00:00:00.000Z`,
        },
      }),
    );
    render(<PracticeHubPage overview={overview} />);

    const exam = card('歷屆試題模擬考');
    // The three papers worked on last, newest first.
    expect(
      within(exam)
        .getAllByRole('link', { name: /已作答/ })
        .map((row) => row.getAttribute('href')),
    ).toEqual([
      '/practice/mock-exam?subject=construction&year=114&q=2',
      '/practice/mock-exam?subject=env&year=113&q=2',
      '/practice/mock-exam?subject=env&year=114&q=2',
    ]);
    expect(within(exam).getByText(/另有 2 份作答中的試卷/)).toBeInTheDocument();
  });

  it('follows a paper started in another tab', () => {
    render(<PracticeHubPage overview={overview} />);
    expect(within(card('歷屆試題模擬考')).getByText('選科目開始')).toBeInTheDocument();

    act(() => {
      writeQuizProgress(mockExamScope('law', 114), {
        'law-114-01': {
          eliminatedOptions: [2],
          elapsedSeconds: 1,
          startedAt: '2026-10-01T00:00:00.000Z',
        },
      });
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'shaneweb:quiz-progress' }),
      );
    });
    expect(
      within(card('歷屆試題模擬考')).getByRole('link', {
        name: /^法規 114 年/,
      }),
    ).toHaveAttribute('href', '/practice/mock-exam?subject=law&year=114&q=1');
  });

  it('does not list a paper that was only opened, never answered', () => {
    writeQuizProgress(mockExamScope('law', 114), {
      'law-114-01': { elapsedSeconds: 40, startedAt: '2026-10-01T00:00:00.000Z' },
    });
    render(<PracticeHubPage overview={overview} />);

    expect(within(card('歷屆試題模擬考')).getByText('選科目開始')).toBeInTheDocument();
  });
});
