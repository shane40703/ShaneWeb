import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HistoryPage } from '@/features/history/history-page';
import {
  createAttempt,
  createDefaultState,
  STORAGE_KEY,
} from '@/lib/study';
import { loadAllQuestions } from '@/server/question-bank.server';
import { AppStateProvider } from '@/state/app-state';

const questions = await loadAllQuestions();
const paperQuestions = questions
  .filter((question) => question.subject === 'law' && question.year === 114)
  .slice(0, 2);

function acceptedAnswer(question: (typeof paperQuestions)[number]) {
  return question.answerKey.kind === 'accepted'
    ? question.answerKey.options[0]
    : 0;
}

describe('HistoryPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('opens a complete answer record for a saved attempt', async () => {
    const attempt = createAttempt({
      mode: 'paper',
      source: paperQuestions,
      answers: Object.fromEntries(
        paperQuestions.map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-25T00:00:00.000Z',
      elapsedSeconds: 60,
    });
    const state = createDefaultState();
    state.attempts = [attempt];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(
      <AppStateProvider>
        <HistoryPage questions={questions} />
      </AppStateProvider>,
    );

    const summary = await screen.findByText('查看完整作答紀錄（2）');
    fireEvent.click(summary);

    expect(
      screen.getByRole('region', { name: '完整作答紀錄' }),
    ).toBeInTheDocument();
    expect(screen.getByText(paperQuestions[0].text)).toBeInTheDocument();
    expect(screen.getByText(paperQuestions[1].text)).toBeInTheDocument();
  });
});
