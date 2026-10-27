import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryRoute from '@/pages/history';
import DailyPracticeHistoryRoute from '@/pages/practice-history';

const mocks = vi.hoisted(() => ({
  useSubjectQuestions: vi.fn(),
  lawRetry: vi.fn(),
  environmentRetry: vi.fn(),
  attempts: [] as Array<{ id?: string; mode?: string; questionIds: string[] }>,
}));

afterEach(cleanup);

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: mocks.useSubjectQuestions,
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    hydrated: true,
    state: {
      attempts: mocks.attempts,
    },
  }),
}));

vi.mock('@/features/history/history-page', () => ({
  HistoryPage: ({
    questions,
    questionBankStatuses,
    onRetryQuestionBank,
    dailyOnly,
  }: {
    questions: Array<{ id: string }>;
    questionBankStatuses: Record<string, string>;
    onRetryQuestionBank: (subjectId: 'law' | 'env') => void;
    dailyOnly?: boolean;
  }) => (
    <div>
      <span>{dailyOnly ? 'daily-only' : 'all-attempts'}</span>
      <span>{questions.map((question) => question.id).join(',')}</span>
      <span>{questionBankStatuses.law}</span>
      <span>{questionBankStatuses.env}</span>
      <button type="button" onClick={() => onRetryQuestionBank('env')}>
        retry environment
      </button>
    </div>
  ),
}));

describe('history route question loading', () => {
  beforeEach(() => {
    mocks.attempts = [{ questionIds: ['law-114-01'] }, { questionIds: ['env-114-01'] }];
    mocks.lawRetry.mockClear();
    mocks.environmentRetry.mockClear();
    mocks.useSubjectQuestions.mockReset();
    mocks.useSubjectQuestions.mockImplementation((subjectIds: string[]) => {
      if (subjectIds[0] === 'law') {
        return {
          questions: [{ id: 'law-114-01' }],
          status: 'ready',
          retry: mocks.lawRetry,
        };
      }
      if (subjectIds[0] === 'env') {
        return {
          questions: [],
          status: 'error',
          retry: mocks.environmentRetry,
        };
      }
      return {
        questions: [],
        status: 'ready',
        retry: vi.fn(),
      };
    });
  });

  it('loads only the papers used by explicitly saved daily practice records', () => {
    mocks.attempts = [
      { id: 'daily-practice-example', mode: 'practice', questionIds: ['law-113-01'] },
      { id: 'legacy-practice', mode: 'practice', questionIds: ['env-114-01'] },
      { id: 'old-paper', mode: 'paper', questionIds: ['construction-114-01'] },
    ];
    render(<DailyPracticeHistoryRoute />);
    expect(screen.getByText('daily-only')).toBeInTheDocument();
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(1, ['law'], [113]);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(2, [], []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(3, [], []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(4, [], []);
  });

  it('retains successful subject questions and retries only failed subjects', () => {
    render(<HistoryRoute />);

    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(1, ['law'], [114]);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(2, ['env'], [114]);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(3, [], []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(4, [], []);
    expect(screen.getByText('law-114-01')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'retry environment' }),
    );
    expect(mocks.environmentRetry).toHaveBeenCalledTimes(1);
    expect(mocks.lawRetry).not.toHaveBeenCalled();
  });
});
