import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingRoute } from './route-progress';

type Handler = (...args: never[]) => void;

const router = vi.hoisted(() => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    handlers,
    events: {
      on: (name: string, handler: Handler) => {
        handlers.set(name, (handlers.get(name) ?? new Set()).add(handler));
      },
      off: (name: string, handler: Handler) => {
        handlers.get(name)?.delete(handler);
      },
    },
  };
});

vi.mock('next/router', () => ({ useRouter: () => ({ events: router.events }) }));

function emit(name: string, ...args: unknown[]) {
  act(() => {
    router.handlers
      .get(name)
      ?.forEach((handler) => (handler as never as (...a: unknown[]) => void)(...args));
  });
}

function Pending() {
  return <output>{usePendingRoute() ?? 'none'}</output>;
}

describe('usePendingRoute', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    assign.mockClear();
    vi.stubGlobal('location', { assign });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('names the page a click is going to, without its query', () => {
    render(<Pending />);
    emit('routeChangeStart', '/exams?question=law-114-01', { shallow: false });
    expect(screen.getByRole('status')).toHaveTextContent('/exams');
  });

  it('stays out of the way of a shallow change inside the page', () => {
    render(<Pending />);
    emit('routeChangeStart', '/practice/mock-exam?q=2', { shallow: true });
    expect(screen.getByRole('status')).toHaveTextContent('none');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it.each(['routeChangeComplete', 'routeChangeError'])(
    'ends on %s and never reloads',
    (name) => {
      render(<Pending />);
      emit('routeChangeStart', '/exams', { shallow: false });
      emit(name, '/exams', { shallow: false });
      expect(screen.getByRole('status')).toHaveTextContent('none');
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(assign).not.toHaveBeenCalled();
    },
  );

  it('opens the page itself when the router drops the click', () => {
    render(<Pending />);
    emit('routeChangeStart', '/exams', { shallow: false });
    act(() => {
      vi.advanceTimersByTime(5_999);
    });
    expect(assign).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(assign).toHaveBeenCalledWith('/exams');
  });

  it('counts from the newest click', () => {
    render(<Pending />);
    emit('routeChangeStart', '/exams', { shallow: false });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    emit('routeChangeStart', '/resources', { shallow: false });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(assign).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/resources');
  });

  it('stops leaving when the browser restores the page from its back/forward cache', () => {
    render(<Pending />);
    emit('routeChangeStart', '/exams', { shallow: false });
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('/exams');
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });

  it('stops waiting when the shell goes away', () => {
    const { unmount } = render(<Pending />);
    emit('routeChangeStart', '/exams', { shallow: false });
    unmount();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(assign).not.toHaveBeenCalled();
  });
});
