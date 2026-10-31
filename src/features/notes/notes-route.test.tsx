import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@/lib/types';
import { questionRefs } from '@/question-bank/derived-data';
import NotesRoute from '@/pages/notes';

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  useQuestionBodies: vi.fn(),
  preloadPaper: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => ({ query: mocks.query, isReady: true }) }));

vi.mock('@/lib/question-bank-client', () => ({
  useQuestionBodies: mocks.useQuestionBodies,
  preloadPaper: mocks.preloadPaper,
  useSimilarRows: () => ({ rows: [], status: 'ready' }),
}));

vi.mock('@/features/notes/notes-page', () => ({
  NotesPage: ({ questions }: { questions: Array<{ id: string; content?: unknown }> }) => (
    <div>
      <span data-testid="entries">{questions.length}</span>
      <span data-testid="bodies">
        {questions.filter((question) => question.content).map((question) => question.id).join(',')}
      </span>
    </div>
  ),
}));

const paperIndex = {
  law: [[114, 2, 0]],
  env: [[114, 2, 0]],
} as const;

const lawQuestion: Question = {
  id: 'law-114-01',
  subject: 'law',
  year: 114,
  questionNumber: 1,
  topic: '測試主題',
  primaryCategory: '測試分類',
  tags: [],
  text: 'law-114-01 題幹',
  content: [{ kind: 'text', text: 'law-114-01 題幹' }],
  options: ['A', 'B', 'C', 'D'],
  answerKey: { kind: 'accepted', options: [0] },
  source: { kind: 'sample' },
};

function renderRoute() {
  render(
    <NotesRoute
      paperIndex={paperIndex}
      initialQuestion={lawQuestion}
      initialSimilar={[]}
    />,
  );
}

afterEach(cleanup);

describe('notes route question loading', () => {
  beforeEach(() => {
    mocks.query = {};
    mocks.useQuestionBodies.mockReset();
    mocks.useQuestionBodies.mockReturnValue({
      byId: new Map(),
      status: 'ready',
      retry: mocks.retry,
    });
  });

  it('knows every question from the index, with a body for the prerendered one', () => {
    renderRoute();

    expect(screen.getByTestId('entries')).toHaveTextContent(
      String(questionRefs(paperIndex).length),
    );
    expect(screen.getByTestId('bodies')).toHaveTextContent('law-114-01');
    expect(mocks.useQuestionBodies).toHaveBeenLastCalledWith(['law-114-01']);
  });

  it('asks only for the question in the URL', () => {
    mocks.query = { question: 'env-114-02' };

    renderRoute();

    expect(mocks.useQuestionBodies).toHaveBeenLastCalledWith(['env-114-02']);
  });
});
