import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestionPrompt, QuestionSourceLine } from '@/components/content/content';
import { loadAllQuestions } from '@/server/question-bank.server';

const questions = await loadAllQuestions();

describe('question content renderer', () => {
  it('renders filename-ordered text before an accessible question image', () => {
    const question = questions.find((candidate) => candidate.id === 'construction-114-01');
    expect(question).toBeDefined();
    expect(question!.content.map((block) => block.kind)).toEqual(['text', 'image']);
    expect(question!.content[1]).toMatchObject({
      kind: 'image',
      src: '/question-bank/構造/114/01/question-02.jpg',
      width: 480,
      height: 444,
    });

    const { container } = render(<QuestionPrompt question={question!} />);
    const text = screen.getByText(/衝擊韌性試片結果圖/);
    const image = screen.getByRole('img', { name: /三個衝擊韌性試片斷口照片/ });
    expect(
      text.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(image).toHaveAttribute('width', '480');
    expect(image).toHaveAttribute('height', '444');
  });

  it('links official questions back to their source paper', () => {
    const question = questions.find((candidate) => candidate.id === 'construction-114-49');
    render(<QuestionSourceLine question={question!} />);
    expect(screen.getByRole('link', { name: /資料來源：考選部/ })).toHaveAttribute(
      'href',
      expect.stringContaining('s=0103&t=Q'),
    );
  });
});
