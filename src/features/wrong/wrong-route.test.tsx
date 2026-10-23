import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WrongRoute from '@/pages/wrong';

const mocks = vi.hoisted(() => ({
  useSubjectQuestions: vi.fn(),
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: mocks.useSubjectQuestions,
}));

vi.mock('@/state/app-state', () => ({
  useAppState: () => ({
    hydrated: true,
    state: {
      attempts: [
        { subject: 'law', year: 114, answers: { 'law-114-01': 0 } },
        { subject: 'law', year: 112, answers: { 'law-112-03': 1 } },
        { subject: 'env', year: 113, answers: { 'env-113-02': 0 } },
        // 選擇題練習 spans years; only its answered questions count.
        {
          mode: 'practice',
          subject: 'law',
          year: null,
          answers: { 'law-105-07': 2, 'law-114-09': 0 },
        },
      ],
    },
  }),
}));

vi.mock('@/features/wrong/wrong-page', () => ({
  WrongPage: ({ questions }: { questions: Array<{ id: string }> }) => (
    <output aria-label="loaded questions">
      {questions.map((question) => question.id).join(',')}
    </output>
  ),
}));

describe('wrong route question loading', () => {
  beforeEach(() => {
    mocks.useSubjectQuestions.mockReset();
    mocks.useSubjectQuestions.mockImplementation((subjects: string[]) => ({
      questions: subjects.length ? [{ id: `${subjects[0]}-question` }] : [],
      status: 'ready',
      retry: vi.fn(),
    }));
  });

  it('loads only the subject years of answered questions', () => {
    render(<WrongRoute />);

    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(
      1,
      ['law'],
      [114, 112, 105],
    );
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(
      2,
      ['env'],
      [113],
    );
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(3, [], []);
    expect(mocks.useSubjectQuestions).toHaveBeenNthCalledWith(4, [], []);
    expect(screen.getByLabelText('loaded questions'))
      .toHaveTextContent('law-question,env-question');
  });
});
