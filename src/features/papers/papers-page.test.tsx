import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PapersPage } from '@/features/papers/papers-page';
import {
  createQuizProgressScope,
  writeQuizProgress,
} from '@/features/quiz/quiz-state';
import type { QuestionSummary } from '@/lib/types';

const router = {
  query: { subject: 'law', year: '114' },
  replace: vi.fn(),
};

vi.mock('next/router', () => ({ useRouter: () => router }));
vi.mock('@/lib/use-client-ready', () => ({ useClientReady: () => true }));

const questions: QuestionSummary[] = [1, 2, 3].map((questionNumber) => ({
  id: `law-114-${questionNumber}`,
  subject: 'law',
  year: 114,
  questionNumber,
  primaryCategory: '建築法',
  topic: '建築法',
  tags: [],
  text: `第 ${questionNumber} 題`,
  path: `/questions/law/114/${questionNumber}`,
}));

afterEach(cleanup);

describe('PapersPage resume action', () => {
  beforeEach(() => {
    window.localStorage.clear();
    router.replace.mockReset();
  });

  it('starts at the first question when there is no draft', () => {
    render(<PapersPage questions={questions} />);

    expect(screen.getByRole('link', { name: '開始作答' })).toHaveAttribute(
      'href',
      questions[0].path,
    );
  });

  it('continues at the first unanswered question when a draft exists', () => {
    const scope = createQuizProgressScope({
      mode: 'paper',
      subject: 'law',
      year: 114,
    })!;
    writeQuizProgress(scope, {
      [questions[0].id]: {
        selected: 0,
        elapsedSeconds: 10,
        startedAt: '2026-08-17T00:00:00.000Z',
      },
      [questions[1].id]: {
        elapsedSeconds: 3,
        startedAt: '2026-08-17T00:01:00.000Z',
      },
    });

    render(<PapersPage questions={questions} />);

    expect(screen.getByRole('link', { name: '繼續作答' })).toHaveAttribute(
      'href',
      questions[1].path,
    );
  });
});
