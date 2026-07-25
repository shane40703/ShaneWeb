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
          href="/questions/law/114/02"
        >
          2
        </QuestionNumberButton>
      </QuestionNumberGrid>,
    );

    const button = screen.getByRole('button', { name: '第 1 題' });
    const link = screen.getByRole('link', {
      name: '前往第 2 題（已標記難題）',
    });
    expect(button.className).toBe(link.className);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(link).not.toHaveAttribute('aria-current');
    expect(link).toHaveAttribute('data-difficult', 'true');
  });
});
