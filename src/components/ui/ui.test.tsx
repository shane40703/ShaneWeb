import { render, screen } from '@testing-library/react';
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
});
