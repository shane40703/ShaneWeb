import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionGroup, ToggleSwitch } from '@/components/ui/ui';

describe('Base UI controls', () => {
  it('toggles a switch from the keyboard', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <ToggleSwitch
        label="深色模式"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    const control = screen.getByRole('switch', { name: '深色模式' });
    control.focus();
    await user.keyboard(' ');
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
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
});
