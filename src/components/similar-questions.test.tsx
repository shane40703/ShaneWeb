import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hasSimilarQuestionsBlock,
  SimilarQuestions,
} from '@/components/similar-questions';
import type { Question } from '@/lib/types';

function lawQuestion(year: number, questionNumber: number): Question {
  const id = `law-${year}-${String(questionNumber).padStart(2, '0')}`;
  return {
    id,
    subject: 'law',
    year,
    questionNumber,
    topic: '建築技術規則',
    primaryCategory: '建築技術規則',
    fineTopic: '防火區劃',
    tags: [],
    text: `${id} 題幹`,
    content: [{ kind: 'text', text: `${id} 題幹` }],
    options: ['A', 'B', 'C', 'D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

afterEach(cleanup);

describe('SimilarQuestions', () => {
  it('lists the newest eight siblings as links and unfolds the rest on request', () => {
    const current = lawQuestion(114, 1);
    const siblings = Array.from({ length: 10 }, (_, index) =>
      lawQuestion(103 + index, 2),
    );
    render(
      <SimilarQuestions
        question={current}
        questions={[current, ...siblings]}
        basePath="/exams"
      />,
    );

    const region = screen.getByRole('region', { name: '類似題目' });
    expect(within(region).getByRole('heading', { name: '類似考題' })).toBeInTheDocument();
    expect(region).toHaveTextContent('同考點「防火區劃」的其他考題，共 10 題');
    const links = within(region).getAllByRole('link');
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAccessibleName(/112 年・第 2 題/);
    expect(links[0]).toHaveAttribute('href', '/exams?question=law-112-02');
    expect(links[7]).toHaveAttribute('href', '/exams?question=law-105-02');

    fireEvent.click(screen.getByRole('button', { name: '顯示全部 10 題' }));
    expect(within(region).getAllByRole('link')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: '只顯示最近 8 題' }));
    expect(within(region).getAllByRole('link')).toHaveLength(8);
  });

  it('renders nothing for a question without a fine topic', () => {
    const question: Question = {
      ...lawQuestion(114, 1),
      subject: 'env',
      fineTopic: undefined,
    };

    expect(hasSimilarQuestionsBlock(question)).toBe(false);
    const { container } = render(
      <SimilarQuestions question={question} questions={[question]} basePath="/notes" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
