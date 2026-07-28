import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RandomPage } from '@/features/random/random-page';
import type { QuestionSummary } from '@/lib/types';

const router = vi.hoisted(() => ({
  query: { subject: 'law' },
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

afterEach(cleanup);

function question(
  id: string,
  questionNumber: number,
  primaryCategory: string,
  topic: string,
  relatedLaws?: readonly string[],
): QuestionSummary {
  return {
    id,
    subject: 'law',
    year: questionNumber <= 2 ? 114 : 113,
    questionNumber,
    primaryCategory,
    topic,
    tags: [],
    ...(relatedLaws ? { relatedLaws } : {}),
    text: `${id} 題幹`,
    path: `/questions/law/114/${String(questionNumber).padStart(2, '0')}`,
  };
}

describe('RandomPage', () => {
  it('draws only from the selected cross-year category', () => {
    router.push.mockReset();
    const questions = [
      question('law-114-01', 1, '建築技術規則', '建築技術規則'),
      question('law-114-02', 2, '建築法', '建築管理法規'),
      question('law-113-03', 3, '建築技術規則', '建築技術規則'),
    ];

    render(<RandomPage questions={questions} />);

    fireEvent.change(screen.getByLabelText('隨機出題題目類別'), {
      target: { value: '建築技術規則' },
    });
    expect(screen.getByText('從 2 題中抽出 2 題')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '抽出題組' }));

    expect(router.push).toHaveBeenCalledOnce();
    const destination = router.push.mock.calls[0][0] as {
      query: { questions: string };
    };
    expect(new Set(destination.query.questions.split(','))).toEqual(
      new Set(['law-114-01', 'law-113-03']),
    );
  });

  it('includes one question in each of its related-law categories', () => {
    router.push.mockReset();
    const questions = [
      question(
        'law-114-01',
        1,
        '建築技術規則',
        '建築技術規則',
        ['建築法', '建築技術規則'],
      ),
      question(
        'law-114-02',
        2,
        '建築法',
        '建築法',
        ['建築法'],
      ),
    ];
    render(<RandomPage questions={questions} />);

    fireEvent.change(screen.getByLabelText('隨機出題題目類別'), {
      target: { value: '建築技術規則' },
    });
    fireEvent.click(screen.getByRole('button', { name: '抽出題組' }));

    const destination = router.push.mock.calls[0][0] as {
      query: { questions: string };
    };
    expect(destination.query.questions).toBe('law-114-01');
  });
});
