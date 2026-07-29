import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QuestionCard,
  QuestionPrompt,
  QuestionSourceLine,
} from '@/components/content/content';
import { loadAllQuestions } from '@/server/question-bank.server';

const questions = await loadAllQuestions();

afterEach(cleanup);

describe('question content renderer', () => {
  it('renders filename-ordered text before an accessible question image', () => {
    const question = questions.find((candidate) => candidate.id === 'construction-114-01');
    expect(question).toBeDefined();
    expect(question!.content.map((block) => block.kind)).toEqual(['text', 'image']);
    expect(question!.content[1]).toMatchObject({
      kind: 'image',
      src: '/question-bank/構造/114/01/question-02.png',
      width: 299,
      height: 278,
    });

    const { container } = render(<QuestionPrompt question={question!} />);
    const text = screen.getByText(/衝擊韌性試片結果圖/);
    const image = screen.getByRole('img', { name: /第 1 題題幹引用圖示/ });
    expect(
      text.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(image).toHaveAttribute('width', '299');
    expect(image).toHaveAttribute('height', '278');

    fireEvent.click(
      screen.getByRole('button', {
        name: /放大題目圖片.*第 1 題題幹引用圖示/,
      }),
    );
    expect(
      screen.getByRole('dialog', {
        name: /放大檢視.*第 1 題題幹引用圖示/,
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: '關閉放大圖片' })[1],
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links official questions back to their source paper', () => {
    const question = questions.find((candidate) => candidate.id === 'construction-114-49');
    render(<QuestionSourceLine question={question!} />);
    expect(screen.getByRole('link', { name: /資料來源：考選部/ })).toHaveAttribute(
      'href',
      expect.stringContaining('s=0103&t=Q'),
    );
  });

  it('uses the working 103 environment-control source paper', () => {
    const question = questions.find((candidate) => candidate.id === 'env-103-01');
    render(<QuestionSourceLine question={question!} />);
    expect(screen.getByRole('link', { name: /資料來源：考選部/ })).toHaveAttribute(
      'href',
      expect.stringContaining('code=103170'),
    );
  });

  it('renders every related law as a question category', () => {
    const question = questions.find((candidate) => candidate.id === 'law-114-01');
    expect(question).toBeDefined();

    render(
      <QuestionCard
        question={{
          ...question!,
          relatedLaws: ['建築法', '建築技術規則'],
        }}
        difficult={false}
        onToggleDifficult={vi.fn()}
      />,
    );

    expect(screen.getByText('建築法')).toBeInTheDocument();
    expect(screen.getByText('建築技術規則')).toBeInTheDocument();
  });
});
