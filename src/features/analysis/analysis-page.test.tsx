import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import type { QuestionSummary } from '@/lib/types';

const router = vi.hoisted(() => ({
  query: { subject: 'law', year: '114' },
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

function question(id: string, questionNumber: number): QuestionSummary {
  return {
    id,
    subject: 'law',
    year: 114,
    questionNumber,
    primaryCategory: '建築技術規則',
    topic: '建築技術規則',
    tags: ['建築技術規則'],
    relatedLaws: ['建築技術規則'],
    text: `${id} 題幹`,
    path: `/questions/law/114/${String(questionNumber).padStart(2, '0')}`,
  };
}

describe('AnalysisPage category quiz', () => {
  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
  });

  it('starts a quiz containing every question in the selected category', () => {
    const questions = [
      question('law-114-01', 1),
      question('law-114-02', 2),
    ];
    render(<AnalysisPage questions={questions} />);

    fireEvent.click(
      screen.getByRole('button', { name: '作答全部 2 題' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: questions[0].path,
      query: {
        mode: 'random',
        questions: 'law-114-01,law-114-02',
      },
    });
  });
});
