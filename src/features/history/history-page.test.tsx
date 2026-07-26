import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HistoryPage } from '@/features/history/history-page';
import { ToastProvider } from '@/components/ui/ui';
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
const environmentQuestions = questions
  .filter((question) => question.subject === 'env')
  .slice(0, 1);

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
    const environmentAttempt = createAttempt({
      mode: 'paper',
      source: environmentQuestions,
      answers: Object.fromEntries(
        environmentQuestions.map((question) => [
          question.id,
          acceptedAnswer(question),
        ]),
      ),
      startedAt: '2026-07-24T00:00:00.000Z',
      elapsedSeconds: 30,
    });
    state.attempts = [
      { ...attempt, id: 'attempt-second' },
      attempt,
      environmentAttempt,
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    render(
      <ToastProvider>
        <AppStateProvider>
          <HistoryPage questions={questions} />
        </AppStateProvider>
      </ToastProvider>,
    );

    const subjectFilters = await screen.findByRole('group', {
      name: '已作答紀錄科目分類',
    });
    expect(
      within(subjectFilters).getByRole('button', { name: '全部 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(subjectFilters).getByRole('button', {
        name: '建築環境控制 1',
      }),
    );
    expect(
      screen.getByRole('heading', { name: /建築環境控制/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /建築法規與實務・114 年/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(subjectFilters).getByRole('button', { name: '全部 3' }),
    );

    const summaries = await screen.findAllByText('查看完整作答紀錄（2）');
    fireEvent.click(summaries[0]);

    const lawGroup = screen
      .getByRole('heading', { name: '建築法規與實務・114 年' })
      .closest('article');
    expect(lawGroup).not.toBeNull();
    expect(screen.getByText('共作答 2 次')).toBeInTheDocument();
    expect(
      within(lawGroup!).getByRole('heading', { name: '第 1 次' }),
    ).toBeInTheDocument();
    expect(
      within(lawGroup!).getByRole('heading', { name: '第 2 次' }),
    ).toBeInTheDocument();
    expect(
      within(lawGroup!).getByRole('button', { name: '清除第 2 次紀錄' }),
    ).toBeInTheDocument();
    expect(
      within(lawGroup!).getAllByRole('button', { name: '再做一次' }),
    ).toHaveLength(1);
    const openedAttempt = summaries[0].parentElement;
    expect(openedAttempt).not.toBeNull();
    const review = within(openedAttempt!).getByRole('region', {
      name: '完整作答紀錄',
    });
    expect(review).toBeInTheDocument();
    expect(within(review).getByText(paperQuestions[0].text)).toBeInTheDocument();
    expect(within(review).getByText(paperQuestions[1].text)).toBeInTheDocument();
  });
});
