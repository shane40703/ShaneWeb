import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { QuizPage } from '@/features/quiz/quiz-page';
import type { Question, QuizQuestion } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  reportPersistence: vi.fn(),
  replace: vi.fn(),
  retry: vi.fn(),
  attempts: [] as Array<Record<string, unknown>>,
  router: {
    isReady: true,
    query: {} as Record<string, string | undefined>,
    pathname: '/questions/[subject]/[year]/[number]',
    replace: vi.fn(),
  },
}));

vi.mock('next/router', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/lib/use-client-ready', () => ({
  useClientReady: () => true,
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: () => ({
    questions: [],
    status: 'ready',
    retry: mocks.retry,
  }),
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    state: {
      answers: {},
      difficultQuestionIds: [],
      attempts: mocks.attempts,
      notes: {},
      noteImages: {},
      discussionPosts: [],
      likedDiscussionPostIds: [],
    },
    dispatch: mocks.dispatch,
    reportPersistence: mocks.reportPersistence,
    hydrated: true,
  }),
}));

function question(questionNumber: number): Question {
  return {
    id: `law-114-${questionNumber}`,
    year: 114,
    subject: 'law',
    questionNumber,
    topic: '建築法',
    primaryCategory: '建築法',
    tags: [],
    text: `第 ${questionNumber} 題題幹`,
    content: [{ kind: 'text', text: `第 ${questionNumber} 題題幹` }],
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

function quizQuestion(item: Question): QuizQuestion {
  return {
    id: item.id,
    subject: item.subject,
    year: item.year,
    questionNumber: item.questionNumber,
    topic: item.topic,
    primaryCategory: item.primaryCategory,
    relatedLaws: item.relatedLaws,
    text: item.text,
    content: item.content,
    options: item.options,
    answerKey: item.answerKey,
    explanation: item.explanation,
    path: `/questions/${item.subject}/${item.year}/${item.questionNumber}`,
  };
}

const currentQuestion = question(43);
const nextQuestion = question(44);
const paper = [quizQuestion(currentQuestion), quizQuestion(nextQuestion)];

afterEach(cleanup);

describe('QuizPage progress presentation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = vi.fn();
    mocks.dispatch.mockReset();
    mocks.reportPersistence.mockReset();
    mocks.replace.mockReset();
    mocks.retry.mockReset();
    mocks.attempts = [];
    mocks.router.query = {};
    mocks.router.replace = mocks.replace;
  });

  it('shows paper position once without a progress bar or answered counter', () => {
    render(<QuizPage question={currentQuestion} paper={paper} />);

    expect(screen.getAllByText('第 1 / 2 題')).toHaveLength(1);
    expect(
      screen.queryByRole('progressbar', { name: '試卷進度' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('已作答 0 / 2')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '題號導覽' })).toBeInTheDocument();
    expect(screen.queryByText('STATIC PATHS')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '前往第 43 題' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: '下一題' })).toHaveAttribute(
      'href',
      '/questions/law/114/44',
    );
    const timer = screen.getByText('作答時間');
    const navigation = timer.closest('footer');
    expect(navigation).toContainElement(
      screen.getByRole('button', { name: '上一題' }),
    );
    expect(navigation).toContainElement(
      screen.getByRole('button', { name: '下一題' }),
    );
    expect(
      screen.getByRole('radiogroup', { name: '請選擇答案' }),
    ).toBeInTheDocument();
    const source = screen.getByText('示範題・非完整官方試卷資料');
    expect(source.nextElementSibling).toHaveTextContent('第 1 / 2 題');
    expect(
      screen.getByRole('button', { name: '標記為難題' }),
    ).toBeInTheDocument();
  });

  it('keeps random-set position and original question number in one label', () => {
    mocks.router.query = {
      mode: 'random',
      questions: paper.map((item) => item.id).join(','),
      quizSession: 'test-session',
    };

    render(<QuizPage question={currentQuestion} paper={paper} />);

    expect(
      screen.getAllByText('題組 1 / 2・原題第 43 題'),
    ).toHaveLength(1);
  });

  it('shuffles displayed options but saves the canonical answer index', () => {
    mocks.router.query = {
      mode: 'random',
      questions: currentQuestion.id,
      quizSession: 'shuffle-session',
      shuffleOptions: '1',
    };

    render(
      <ToastProvider>
        <QuizPage question={currentQuestion} paper={paper} />
      </ToastProvider>,
    );

    const optionTexts = [
      ...screen.getByRole('radiogroup', { name: '請選擇答案' })
        .querySelectorAll('label > span:last-child'),
    ].map((element) => element.textContent);
    expect(optionTexts).not.toEqual(['選項 A', '選項 B', '選項 C', '選項 D']);

    fireEvent.click(screen.getByText('選項 A').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '對答案' }));

    const saveAttempt = mocks.dispatch.mock.calls.find(
      ([action]) => action.type === 'save-attempt',
    )?.[0];
    expect(saveAttempt.attempt.answers[currentQuestion.id]).toBe(0);
  });

  it('shows only the source question number in single-question mode', () => {
    mocks.router.query = { mode: 'single' };

    render(<QuizPage question={currentQuestion} paper={paper} />);

    expect(screen.getAllByText('第 43 題')).toHaveLength(1);
    expect(screen.queryByText('第 1 / 1 題')).not.toBeInTheDocument();
  });

  it('shows answer feedback without the empty explanation panel', () => {
    mocks.router.query = { mode: 'single' };

    render(
      <ToastProvider>
        <QuizPage question={currentQuestion} paper={paper} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('選項 B').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '對答案' }));

    expect(screen.getByRole('status')).toHaveTextContent('答錯了');
    expect(screen.getByRole('status')).not.toHaveTextContent('詳解');
    expect(screen.getByRole('status')).not.toHaveTextContent('目前尚無詳解');
  });

  it('groups wrong answers by question category after submission', () => {
    mocks.router.query = {
      mode: 'random',
      questions: currentQuestion.id,
      quizSession: 'test-session',
    };

    render(
      <ToastProvider>
        <QuizPage question={currentQuestion} paper={paper} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('選項 B').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '對答案' }));

    expect(
      screen.queryByRole('region', { name: '錯題類型統計' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '標記為難題' }));
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'toggle-difficult',
      questionId: currentQuestion.id,
    });
    fireEvent.click(
      screen.getByRole('button', { name: '錯題統計結果' }),
    );

    const summary = screen.getByRole('region', { name: '錯題類型統計' });
    expect(summary).toHaveTextContent('建築法');
    expect(summary).toHaveTextContent('第 43 題');
    expect(summary).toHaveTextContent('1 題');
    expect(
      screen.getByRole('tab', { name: /建築法/ }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tabpanel', { name: '建築法錯題' }),
    ).toHaveTextContent('第 43 題題幹');
    expect(
      screen.getByRole('region', { name: '第 43 題錯題選項' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '完整作答紀錄' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('tab', { name: '逐題作答結果' }),
    );
    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '錯題類型統計' }),
    ).not.toBeInTheDocument();
  });

  it('does not offer an empty wrong-answer view after a perfect result', () => {
    mocks.router.query = {
      mode: 'random',
      questions: currentQuestion.id,
      quizSession: 'test-session',
    };

    render(
      <ToastProvider>
        <QuizPage question={currentQuestion} paper={paper} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('選項 A').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '對答案' }));

    expect(
      screen.queryByRole('button', { name: '錯題統計結果' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: '作答結果分頁' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看第 43 題結果' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not pull the page back to the result map on mobile', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    mocks.router.query = {
      mode: 'random',
      questions: currentQuestion.id,
      quizSession: 'test-session',
    };

    render(
      <ToastProvider>
        <QuizPage question={currentQuestion} paper={paper} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('選項 A').closest('label')!);
    fireEvent.click(screen.getByRole('button', { name: '對答案' }));

    expect(
      screen.getByRole('link', { name: '查看第 43 題結果' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('restores a submitted paper review from the URL attempt id', () => {
    mocks.router.query = { reviewAttempt: 'attempt-review' };
    mocks.attempts = [{
      id: 'attempt-review',
      mode: 'paper',
      subject: 'law',
      year: 114,
      startedAt: '2026-08-17T00:00:00.000Z',
      submittedAt: '2026-08-17T00:10:00.000Z',
      elapsedSeconds: 600,
      questionIds: paper.map((item) => item.id),
      answers: { [currentQuestion.id]: 0, [nextQuestion.id]: 1 },
      correctCount: 1,
      wrongCount: 1,
      unansweredCount: 0,
    }];

    render(
      <ToastProvider>
        <QuizPage question={currentQuestion} paper={paper} />
      </ToastProvider>,
    );

    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 / 2 題答對')).toBeInTheDocument();
  });
});
