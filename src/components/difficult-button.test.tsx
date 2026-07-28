import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DifficultButton } from '@/components/difficult-button';

describe('DifficultButton', () => {
  it('uses the same complete label and toggle behavior in every context', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <DifficultButton active={false} onClick={onClick} />,
    );

    const button = screen.getByRole('button', { name: '標記為難題' });
    expect(button).toHaveTextContent('標記為難題');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<DifficultButton active onClick={onClick} />);
    expect(
      screen.getByRole('button', { name: '取消難題標記' }),
    ).toHaveTextContent('已標記難題');
  });
});
