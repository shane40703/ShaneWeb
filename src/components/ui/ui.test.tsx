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
  it('appends original-option references without changing radio values or disabled behavior', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<OptionGroup label="對答案" options={['原本第三項', '原本第一項']}
      value={0} disabled originalOptionIndexes={[2, 0]} onValueChange={onValueChange} />);
    expect(screen.getByText('（原選項 C）')).toBeInTheDocument();
    expect(screen.getByText('（原選項 A）')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName(/原本第三項.*原選項 C/);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByText('（原選項 A）'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('clears an answer from its label or radio on a later click', async () => {
    let now = 1_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const user = userEvent.setup();
    render(<ControlledOptions />);
    const radios = screen.getAllByRole('radio');
    await user.click(screen.getByText('第一個答案'));
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    now += 1000;
    await user.click(screen.getByText('第一個答案'));
    expect(radios.every(radio => radio.getAttribute('aria-checked') === 'false')).toBe(true);
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    now += 1000;
    await user.click(radios[1]);
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByText('刪去的答案'));
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');
    clock.mockRestore();
  });

  it('keeps the answer through a double-tap, even when it replaces another one', async () => {
    const user = userEvent.setup();
    render(<ControlledOptions />);
    const radios = screen.getAllByRole('radio');
    await user.dblClick(screen.getByText('第一個答案'));
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await user.dblClick(screen.getByText('第二個答案'));
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('names every radio by its letter and text', () => {
    render(<ControlledOptions />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName('A 第一個答案');
    expect(radios[1]).toHaveAccessibleName('B 第二個答案');
    expect(radios[2]).toHaveAccessibleName('C 刪去的答案');
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
