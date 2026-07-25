import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';

afterEach(cleanup);

describe('QuestionAnswerPanel', () => {
  it('shows every option and all accepted answers', () => {
    const { container } = render(
      <QuestionAnswerPanel
        question={{
          options: ['選項 A', '選項 B', '選項 C', '選項 D'],
          answerKey: { kind: 'accepted', options: [0, 2] },
        }}
      />,
    );

    expect(
      screen.getByRole('region', { name: '題目選項' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('A、C')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-accepted="true"]')).toHaveLength(
      2,
    );
  });

  it('labels all-credit questions directly', () => {
    render(
      <QuestionAnswerPanel
        question={{
          options: ['選項 A', '選項 B', '選項 C', '選項 D'],
          answerKey: { kind: 'all-credit' },
        }}
      />,
    );

    expect(screen.getByText('本題一律給分')).toBeInTheDocument();
    expect(screen.getAllByText('正確選項')).toHaveLength(4);
  });
});
