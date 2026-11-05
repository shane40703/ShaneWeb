import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubLayout } from './hub-layout';

afterEach(cleanup);

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      按了 {count} 次
    </button>
  );
}

describe('HubLayout', () => {
  it('follows a plain click itself, and leaves a modified click to the browser', () => {
    const follow = vi.fn();
    render(
      <HubLayout hub={{ href: '/exams', label: '考古題討論版' }} onFollow={follow}>
        <p>頁面內容</p>
      </HubLayout>,
    );

    const back = screen.getByRole('link', { name: '返回考古題討論版' });
    expect(back).toHaveAttribute('href', '/exams');
    expect(fireEvent.click(back)).toBe(false);
    expect(follow).toHaveBeenCalledOnce();
    expect(fireEvent.click(back, { metaKey: true })).toBe(true);
    expect(fireEvent.click(back, { button: 1 })).toBe(true);
    expect(follow).toHaveBeenCalledOnce();
  });

  it('puts a space between 返回 and a label that starts with a year', () => {
    render(
      <HubLayout hub={{ href: '/exams/law/114', label: '114 年營建法規與實務考古題' }}>
        <p>頁面內容</p>
      </HubLayout>,
    );

    expect(
      screen.getByRole('link', { name: '返回 114 年營建法規與實務考古題' }),
    ).toHaveAttribute('href', '/exams/law/114');
  });

  it('draws no way back at the top, and keeps the page when one appears', () => {
    const { rerender } = render(
      <HubLayout hub={null} onFollow={() => {}}>
        <Counter />
      </HubLayout>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '按了 0 次' }));

    rerender(
      <HubLayout hub={{ href: '/exams', label: '考古題討論版' }} onFollow={() => {}}>
        <Counter />
      </HubLayout>,
    );
    expect(screen.getByRole('link', { name: '返回考古題討論版' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '按了 1 次' })).toBeInTheDocument();
  });
});
