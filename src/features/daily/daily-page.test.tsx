import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, SubjectId } from '@/lib/types';
import { DailyPage } from './daily-page';

const appState = vi.hoisted(() => ({
  dispatch: vi.fn(),
  reportPersistence: vi.fn(),
}));

function question(subject: SubjectId, number: number): Question {
  return {
    id: `${subject}-114-${String(number).padStart(2, '0')}`,
    subject,
    year: 114,
    questionNumber: number,
    topic: '測試主題',
    primaryCategory: '測試分類',
    tags: [],
    text: `${subject} 第 ${number} 題`,
    content: [{ kind: 'text', text: `${subject} 第 ${number} 題` }],
    options: ['選項 A', '選項 B', '選項 C', '選項 D'],
    answerKey: { kind: 'accepted', options: [0] },
    source: { kind: 'sample' },
  };
}

const allQuestions = (['law', 'env'] as const).flatMap((subject) =>
  Array.from({ length: 60 }, (_, index) => question(subject, index + 1)),
);

vi.mock('@/state/app-state', () => ({
  useAppState: () => appState,
}));

vi.mock('@/lib/question-bank-client', () => ({
  useSubjectQuestions: (subjectIds: SubjectId[]) => ({
    questions: allQuestions.filter((item) => subjectIds.includes(item.subject)),
    status: 'ready',
    retry: vi.fn(),
  }),
}));

beforeEach(() => {
  window.localStorage.clear();
  appState.dispatch.mockReset();
  appState.reportPersistence.mockReset();
});

afterEach(cleanup);

describe('DailyPage', () => {
  it('creates fifty questions for each selected subject', async () => {
    render(<DailyPage />);

    expect(await screen.findByText('每日 50 題闖關')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /建築環境控制/ }));
    expect(screen.getByText('已選 2 科・今日共 100 題')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /建立今日挑戰/ }));

    const statistics = await screen.findByLabelText('每日練習統計');
    await waitFor(() => expect(within(statistics).getByText('/ 100')).toBeInTheDocument());
    expect(screen.getByText('法規・環控')).toBeInTheDocument();
  });
});
