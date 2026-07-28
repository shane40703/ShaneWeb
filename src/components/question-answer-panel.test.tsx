import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';

afterEach(cleanup);

describe('QuestionAnswerPanel', () => {
  it('marks accepted options with accessible names without repeating the answer below', () => {
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
    expect(
      screen.getByRole('listitem', {
        name: '正確選項 A：選項 A',
      }),
    ).toHaveAttribute('data-accepted', 'true');
    expect(
      screen.getByRole('listitem', {
        name: '正確選項 C：選項 C',
      }),
    ).toHaveAttribute('data-accepted', 'true');
    expect(container.querySelectorAll('[data-accepted="true"]')).toHaveLength(
      2,
    );
    expect(screen.queryByText('正確答案')).not.toBeInTheDocument();
    expect(screen.queryByText('A、C')).not.toBeInTheDocument();
  });

  it('gives every option an accessible correct-option name for all-credit questions', () => {
    render(
      <QuestionAnswerPanel
        question={{
          options: ['選項 A', '選項 B', '選項 C', '選項 D'],
          answerKey: { kind: 'all-credit' },
        }}
      />,
    );

    expect(
      screen.getAllByRole('listitem', {
        name: /^正確選項 [A-D]：選項 [A-D]$/,
      }),
    ).toHaveLength(4);
    expect(screen.queryByText('本題一律給分')).not.toBeInTheDocument();
    expect(screen.queryByText('正確答案')).not.toBeInTheDocument();
  });

  it('shows selected-answer status while keeping correct-answer semantics', () => {
    render(
      <QuestionAnswerPanel
        question={{
          options: ['選項 A', '選項 B', '選項 C', '選項 D'],
          answerKey: { kind: 'accepted', options: [1] },
        }}
        heading={null}
        ariaLabel="第 1 題完整選項"
        selectedIndex={0}
        showStatusLabels
      />,
    );

    expect(
      screen.getByRole('region', { name: '第 1 題完整選項' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('listitem', { name: '你的答案 A：選項 A' }),
    ).toHaveAttribute('data-selected', 'true');
    expect(
      screen.getByRole('listitem', { name: '正確選項 B：選項 B' }),
    ).toHaveAttribute('data-accepted', 'true');
    expect(screen.getByText('你的答案')).toBeInTheDocument();
    expect(screen.getByText('正確答案')).toBeInTheDocument();
  });
});
