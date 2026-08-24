import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryRoute from '@/pages/history';

const mocks = vi.hoisted(() => ({
  useSubjectQuestions: vi.fn(),
  lawRetry: vi.fn(),
  environmentRetry: vi.fn(),
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: mocks.useSubjectQuestions,
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    hydrated: true,
    state: {
      attempts: [
        { questionIds: ['law-114-01'] },
        { questionIds: ['env-114-01'] },
      ],
    },
  }),
}));

vi.mock('@/features/history/history-page', () => ({
  HistoryPage: ({
    questions,
    questionBankStatuses,
    onRetryQuestionBank,
  }: {
    questions: Array<{ id: string }>;
    questionBankStatuses: Record<string, string>;
    onRetryQuestionBank: (subjectId: 'law' | 'env') => void;
  }) => (
    <div>
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
