import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  QuestionNumberPicker,
  QuestionSelector,
} from '@/components/question-selector';

describe('QuestionSelector', () => {
  it('uses the shared subject controls and appends 年 to numeric year buttons', async () => {
    const user = userEvent.setup();
    const onSubjectChange = vi.fn();
    const onYearChange = vi.fn();

    render(
      <QuestionSelector
        subjectId="law"
        year={114}
        yearOptions={[
          { value: 'all', label: '跨年度' },
          { value: 114 },
          { value: 113, disabled: true },
        ]}
        onSubjectChange={onSubjectChange}
        onYearChange={onYearChange}
        ariaLabel="試卷選擇"
      />,
    );

    expect(screen.getByRole('button', { name: '114 年' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '113 年' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '114' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /建築環境控制/ }));
    await user.click(screen.getByRole('button', { name: '跨年度' }));
    expect(onSubjectChange).toHaveBeenCalledWith('env');
    expect(onYearChange).toHaveBeenCalledWith('all');
  });

  it('supports the question-number extension', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <QuestionNumberPicker
        questions={[
          {
            id: 'law-114-01',
            questionNumber: 1,
            difficult: true,
            hasContent: true,
          },
          { id: 'law-114-02', questionNumber: 2 },
        ]}
        value="law-114-01"
        onValueChange={onValueChange}
        showStatusLegend
      />,
    );

    expect(
      screen.getByRole('button', {
        name: '第 1 題（已標記難題、有詳解或討論）',
      }),
    ).toHaveAttribute('data-content', 'true');
    expect(
      screen.getByRole('note', { name: '題號標記說明' }),
    ).toHaveTextContent('有詳解或討論');
    await user.click(screen.getByRole('button', { name: '第 2 題' }));
    expect(onValueChange).toHaveBeenCalledWith('law-114-02');
  });
});
