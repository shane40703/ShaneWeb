import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionGroup } from '@/components/ui/ui';

describe('Base UI controls', () => {
  it('selects an answer using the radio group', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <OptionGroup
        label="請選擇答案"
        options={['第一個答案', '第二個答案']}
        onValueChange={onValueChange}
      />,
    );
    await user.click(screen.getByText('第二個答案'));
    expect(onValueChange).toHaveBeenCalledWith(1);
  });

  it('lets a learner eliminate and restore options without selecting them', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onToggleEliminated = vi.fn();
    const { container } = render(
      <OptionGroup
        label="請選擇答案"
        options={['第一個答案', '第二個答案']}
        eliminatedValues={[0]}
        onValueChange={onValueChange}
        onToggleEliminated={onToggleEliminated}
      />,
    );

    expect(within(container).getAllByRole('radio')[0]).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(container).getByRole('button', { name: '恢復選項 A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(container).getByRole('button', { name: '刪去選項 B' }));

    expect(onToggleEliminated).toHaveBeenCalledWith(1);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
