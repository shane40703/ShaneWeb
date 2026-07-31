import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import NotesRoute from '@/pages/notes';

const mocks = vi.hoisted(() => ({
  useSubjectQuestions: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: mocks.useSubjectQuestions,
}));

vi.mock('@/features/notes/notes-page', () => ({
  NotesPage: ({
    questions,
    questionBankStatuses,
    onRequestQuestionBank,
  }: {
    questions: Array<{ id: string }>;
    questionBankStatuses: Record<string, string>;
    onRequestQuestionBank: (subjectId: SubjectId) => void;
  }) => (
    <div>
      <span data-testid="questions">
        {questions.map((question) => question.id).join(',')}
      </span>
      <span data-testid="environment-status">
        {questionBankStatuses.env}
      </span>
      <button type="button" onClick={() => onRequestQuestionBank('env')}>
        載入環控
      </button>
    </div>
  ),
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
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

const lawQuestion = question('law-114-01', 'law');
const environmentQuestion = question('env-114-01', 'env');

afterEach(cleanup);

describe('notes route question loading', () => {
  beforeEach(() => {
    mocks.retry.mockClear();
    mocks.useSubjectQuestions.mockReset();
    mocks.useSubjectQuestions.mockImplementation((subjectIds: SubjectId[]) => ({
      questions: subjectIds[0] === 'env' ? [environmentQuestion] : [],
      status: 'ready',
      retry: mocks.retry,
    }));
  });

  it('does not request any API-backed subject until it is needed', () => {
    render(<NotesRoute initialQuestions={[lawQuestion]} />);

    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(1, []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(2, []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(3, []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(4, []);
    expect(screen.getByTestId('questions')).toHaveTextContent(lawQuestion.id);
    expect(screen.getByTestId('environment-status')).toHaveTextContent('idle');
  });

  it('loads and retains a subject after an explicit request', () => {
    render(<NotesRoute initialQuestions={[lawQuestion]} />);

    fireEvent.click(screen.getByRole('button', { name: '載入環控' }));

    expect(
      mocks.useSubjectQuestions.mock.calls.some(
        ([subjectIds]) => subjectIds[0] === 'env',
      ),
    ).toBe(true);
    expect(screen.getByTestId('questions')).toHaveTextContent(
      `${lawQuestion.id},${environmentQuestion.id}`,
    );
    expect(screen.getByTestId('environment-status')).toHaveTextContent('ready');
  });
});
