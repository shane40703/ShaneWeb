import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DifficultRoute from '@/pages/difficult';

const mocks = vi.hoisted(() => ({
  useSubjectFacets: vi.fn(),
  lawRetry: vi.fn(),
  environmentRetry: vi.fn(),
  writtenRetry: vi.fn(),
  written: { status: 'ready', byId: new Map<string, { id: string }>() },
  marks: ['law-114-01', 'env-114-01'],
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectFacets: mocks.useSubjectFacets,
  useQuestionBodies: () => ({ ...mocks.written, retry: mocks.writtenRetry }),
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    hydrated: true,
    state: {
      difficultQuestionIds: mocks.marks,
    },
  }),
}));

vi.mock('@/features/difficult/difficult-page', () => ({
  DifficultPage: ({
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

describe('difficult route question loading', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.marks = ['law-114-01', 'env-114-01'];
    mocks.written.status = 'ready';
    mocks.written.byId = new Map();
    mocks.writtenRetry.mockClear();
    mocks.lawRetry.mockClear();
    mocks.environmentRetry.mockClear();
    mocks.useSubjectFacets.mockReset();
    mocks.useSubjectFacets.mockImplementation((subjectIds: string[]) => {
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

  it('retains successful subjects and retries only the selected failed subject', () => {
    render(<DifficultRoute />);

    expect(mocks.useSubjectFacets).toHaveBeenNthCalledWith(1, ['law']);
    expect(mocks.useSubjectFacets).toHaveBeenNthCalledWith(2, ['env']);
    expect(mocks.useSubjectFacets).toHaveBeenNthCalledWith(3, []);
    expect(mocks.useSubjectFacets).toHaveBeenNthCalledWith(4, []);
    expect(screen.getByText('law-114-01')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'retry environment' }),
    );
    expect(mocks.environmentRetry).toHaveBeenCalledOnce();
    expect(mocks.lawRetry).not.toHaveBeenCalled();
  });

  it('lists a written mark once its paper is here, and waits or retries with the rest', () => {
    mocks.marks = [...mocks.marks, 'structure-114-written-01'];
    mocks.written.status = 'error';
    render(<DifficultRoute />);
    expect(screen.getAllByText('error').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('ready')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'retry environment' }));
    expect(mocks.writtenRetry).toHaveBeenCalledOnce();
  });

  it('adds the written question to the list', () => {
    mocks.marks = [...mocks.marks, 'structure-114-written-01'];
    mocks.written.byId = new Map([
      ['structure-114-written-01', { id: 'structure-114-written-01' }],
    ]);
    render(<DifficultRoute />);
    expect(screen.getByText(/structure-114-written-01/)).toBeInTheDocument();
  });
});
