import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePageScrollLock } from './use-page-scroll-lock';

const locked = () => document.documentElement.hasAttribute('data-page-scroll-locked');

describe('usePageScrollLock', () => {
  it('locks the page only while active', () => {
    const { rerender, unmount } = renderHook(({ active }) => usePageScrollLock(active), {
      initialProps: { active: false },
    });
    expect(locked()).toBe(false);
    rerender({ active: true });
    expect(locked()).toBe(true);
    rerender({ active: false });
    expect(locked()).toBe(false);
    rerender({ active: true });
    unmount();
    expect(locked()).toBe(false);
  });

  it('stays locked until the last overlay closes', () => {
    const first = renderHook(() => usePageScrollLock(true));
    const second = renderHook(() => usePageScrollLock(true));
    first.unmount();
    expect(locked()).toBe(true);
    second.unmount();
    expect(locked()).toBe(false);
  });
});
