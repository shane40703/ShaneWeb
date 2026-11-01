import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@/lib/types';
import { PracticeResultView } from './practice-result';
import type { PracticeResult } from './practice-session';

vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }));

const result = {
  session: {
    subject: 'law',
    questionIds: ['law-114-01', 'law-113-02'],
    answers: {},
    optionOrders: {},
  },
  summary: {
    total: 2,
    answered: 0,
    correct: 0,
    wrong: 0,
    unanswered: 2,
    accuracy: null,
    elapsedSeconds: 0,
    wrongIds: [],
  },
} as unknown as PracticeResult;

const noQuestions = new Map<string, Question>();

function view(props: Partial<React.ComponentProps<typeof PracticeResultView>>) {
  return render(
    <PracticeResultView
      result={result}
      questionById={noQuestions}
      onRetry={() => {}}
      onNewDraw={() => {}}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe('PracticeResultView', () => {
  it('says the questions are on their way instead of showing an empty list', () => {
    view({ bodyStatus: 'loading' });
    expect(screen.getByText('正在載入題目內容…')).toBeInTheDocument();
  });

  it('offers a retry when they cannot be downloaded', () => {
    const retry = vi.fn();
    view({ bodyStatus: 'error', onRetryBodies: retry });

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('adds nothing when every question is here', () => {
    view({ bodyStatus: 'ready' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新載入' })).not.toBeInTheDocument();
  });
});
