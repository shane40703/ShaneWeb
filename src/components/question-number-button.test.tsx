import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  QuestionNumberButton,
  QuestionNumberGrid,
} from '@/components/question-number-button';

describe('QuestionNumberButton', () => {
  it('shares one style between selector buttons and navigator links', () => {
    render(
      <QuestionNumberGrid>
        <QuestionNumberButton ariaLabel="第 1 題" active onClick={() => undefined}>
          1
        </QuestionNumberButton>
        <QuestionNumberButton
          ariaLabel="前往第 2 題"
          active={false}
          difficult
          wrong
          noted
          href="/questions/law/114/02"
        >
          2
        </QuestionNumberButton>
      </QuestionNumberGrid>,
    );

    const button = screen.getByRole('button', { name: '第 1 題' });
    const link = screen.getByRole('link', {
      name: '前往第 2 題（答錯、已標記難題、有筆記）',
    });
    expect(button.className).toBe(link.className);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(link).not.toHaveAttribute('aria-current');
    expect(link).toHaveAttribute('data-difficult', 'true');
    expect(link).toHaveAttribute('data-wrong', 'true');
    expect(link).toHaveAttribute('data-noted', 'true');
  });

  it('shows an answer sheet tile with the letter and marks, and no verdict', () => {
    render(
      <QuestionNumberGrid>
        <QuestionNumberButton
          ariaLabel="前往第 3 題"
          active={false}
          sheet
          answer="B"
          review
          difficult
          stateLabel="已作答 B"
          href="/practice/mock-exam?q=3"
          shallow
        >
          3
        </QuestionNumberButton>
      </QuestionNumberGrid>,
    );

    const tile = screen.getByRole('link', {
      name: '前往第 3 題（已作答 B、已標記難題、待檢查）',
    });
    expect(tile).toHaveTextContent('3B');
    expect(tile).toHaveAttribute('data-sheet', 'true');
    expect(tile).toHaveAttribute('data-filled', 'true');
    expect(tile).toHaveAttribute('data-review', 'true');
    expect(tile).not.toHaveAttribute('data-answered');
  });
});
