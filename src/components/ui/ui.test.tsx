import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OptionGroup } from '@/components/ui/ui';

afterEach(cleanup);

function ControlledOptions({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<number>();
  return <OptionGroup label="請選擇答案" options={['第一個答案', '第二個答案', '刪去的答案']}
    value={value} onValueChange={setValue} disabled={disabled} eliminatedValues={[2]} />;
}

describe('Base UI controls', () => {
  it('clears an answer from its label or radio, including a quick second click', async () => {
    const user = userEvent.setup();
    render(<ControlledOptions />);
    const radios = screen.getAllByRole('radio');
    await user.click(screen.getByText('第一個答案'));
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByText('第一個答案'));
    expect(radios.every(radio => radio.getAttribute('aria-checked') === 'false')).toBe(true);
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    await user.dblClick(radios[0]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByText('刪去的答案'));
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
  });

  it('retains keyboard selection, allows Space to clear and locks disabled answers', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ControlledOptions />);
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    await user.keyboard('[Space]');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('[Space]');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('[ArrowRight]');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    rerender(<ControlledOptions disabled />);
    await user.click(screen.getByText('第二個答案'));
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });

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
