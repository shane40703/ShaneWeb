import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppStateProvider, useAppState } from '@/state/app-state';

function PersistenceProbe() {
  const { persistence, reportPersistence } = useAppState();

  return (
    <>
      <output aria-label="persistence">{persistence}</output>
      <button
        onClick={() => reportPersistence('quiz-progress', 'quota-exceeded')}
      >
        quiz quota
      </button>
      <button onClick={() => reportPersistence('quiz-progress', 'saved')}>
        quiz saved
      </button>
      <button onClick={() => reportPersistence('app-state', 'saved')}>
        state saved
      </button>
    </>
  );
}

describe('AppStateProvider persistence reporting', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a failed source visible until that source saves successfully', () => {
    render(
      <AppStateProvider>
        <PersistenceProbe />
      </AppStateProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'quiz quota' }));
    expect(screen.getByLabelText('persistence')).toHaveTextContent(
      'quota-exceeded',
    );

    fireEvent.click(screen.getByRole('button', { name: 'state saved' }));
    expect(screen.getByLabelText('persistence')).toHaveTextContent(
      'quota-exceeded',
    );

    fireEvent.click(screen.getByRole('button', { name: 'quiz saved' }));
    expect(screen.getByLabelText('persistence')).toHaveTextContent('saved');
  });
});
