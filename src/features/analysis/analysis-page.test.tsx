import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from '@/features/analysis/analysis-page';
import type { QuestionSummary } from '@/lib/types';

const router = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

afterEach(cleanup);

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
    router.query = { subject: 'law', year: '114' };
    router.push.mockReset();
    router.replace.mockReset();
  });

  it('filters cross-year analysis by a selected year range', () => {
    router.query = {
      subject: 'law',
      year: 'all',
      fromYear: '113',
      toYear: '114',
    };
    const questions = [
      question('law-114-01', 1),
      { ...question('law-113-01', 1), id: 'law-113-01', year: 113 },
      { ...question('law-112-01', 1), id: 'law-112-01', year: 112 },
    ];

    render(<AnalysisPage questions={questions} />);

    expect(screen.getByText(/總題數/)).toHaveTextContent('2 題');
    expect(screen.getByLabelText('分析起始年度')).toHaveValue('113');
    expect(screen.getByLabelText('分析結束年度')).toHaveValue('114');
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

  it('can start from a secondary related-law category', () => {
    const questions = [
      {
        ...question('law-114-01', 1),
        relatedLaws: ['建築法', '建築技術規則'],
      },
      {
        ...question('law-114-02', 2),
        primaryCategory: '建築法',
        topic: '建築法',
        relatedLaws: ['建築法'],
      },
    ];
    render(<AnalysisPage questions={questions} />);

    fireEvent.click(
      screen.getByRole('button', { name: /建築技術規則1 題/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '作答全部 1 題' }),
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: questions[0].path,
      query: {
        mode: 'random',
        questions: questions[0].id,
      },
    });
  });
});
