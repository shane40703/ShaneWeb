import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizPage } from '@/features/quiz/quiz-page';
import type { Question, QuizQuestion } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  reportPersistence: vi.fn(),
  replace: vi.fn(),
  retry: vi.fn(),
  router: {
    isReady: true,
    query: {} as Record<string, string | undefined>,
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
      attempts: [],
      notes: {},
      noteImages: {},
      discussionPosts: [],
      likedDiscussionPostIds: [],
    },
    dispatch: mocks.dispatch,
    reportPersistence: mocks.reportPersistence,
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
    mocks.dispatch.mockReset();
    mocks.reportPersistence.mockReset();
    mocks.replace.mockReset();
    mocks.retry.mockReset();
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

  it('shows only the source question number in single-question mode', () => {
    mocks.router.query = { mode: 'single' };

    render(<QuizPage question={currentQuestion} paper={paper} />);

    expect(screen.getAllByText('第 43 題')).toHaveLength(1);
    expect(screen.queryByText('第 1 / 1 題')).not.toBeInTheDocument();
  });
});
