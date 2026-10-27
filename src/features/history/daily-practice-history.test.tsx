import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { createRecordablePracticeResult } from '@/features/practice/daily-practice-recording';
import { createPracticeSessionFromQuestions } from '@/features/practice/practice-session';
import { createDefaultState, STORAGE_KEY } from '@/lib/study';
import type { Question } from '@/lib/types';
import { AppStateProvider } from '@/state/app-state';
import { HistoryPage } from './history-page';

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const question: Question = {
  id: 'law-114-01', subject: 'law', year: 114, questionNumber: 1,
  text: '每日履歷題目', content: [{ kind: 'text', text: '每日履歷題目' }], options: ['甲選項', '乙選項'],
  answerKey: { kind: 'accepted', options: [0] }, topic: '測試', primaryCategory: '測試', tags: [], source: { kind: 'sample' },
};
const session = createPracticeSessionFromQuestions([question], 'law', false);
session.answers[question.id] = { selected: 1, correct: false };
session.elapsedSeconds[question.id] = 42;
const recorded = createRecordablePracticeResult(session, new Map([[question.id, question]]), '2026-10-27T04:00:00.000Z').recording!.records[0].attempt;

function renderHistory(withRecord = true, dailyOnly = true) {
  const state = createDefaultState();
  state.attempts = [
    ...(withRecord ? [recorded] : []),
    { ...recorded, id: 'legacy-practice' },
    { ...recorded, id: 'mock-paper', mode: 'paper', year: 114 },
  ];
  state.notes[question.id] = '必須保留的筆記';
  state.difficultQuestionIds = [question.id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return render(<ToastProvider><AppStateProvider><HistoryPage questions={[question]} dailyOnly={dailyOnly} /></AppStateProvider></ToastProvider>);
}
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Daily practice history', () => {
  it('lists only explicit daily saves and provides the complete answer record and timing', async () => {
    const user = userEvent.setup();
    renderHistory();
    const filters = await screen.findByRole('group', { name: '每日練習履歷科目分類' });
    expect(within(filters).getByRole('button', { name: /建築法規與實務/ })).toHaveTextContent('1');
    const group = screen.getByLabelText('每日抽題練習作答紀錄');
    await user.click(group.querySelector('summary')!);
    expect(within(group).getByText('正確率 0%')).toBeVisible();
    expect(within(group).getByText(/作答時間 00:00:42/)).toBeVisible();
    expect(screen.queryByText('繼續作答 114 年')).not.toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: '查看完整作答紀錄（1）' }));
    expect(await screen.findByText('每日履歷題目')).toBeVisible();
    expect(within(group).getByText('標準答案：A')).toBeInTheDocument();
  });

  it('confirms deletion, retains other records and notes, and keeps a deletion marker for sync', async () => {
    const user = userEvent.setup();
    renderHistory();
    await screen.findByRole('group', { name: '每日練習履歷科目分類' });
    await user.click(screen.getByLabelText('每日抽題練習作答紀錄').querySelector('summary')!);
    await user.click(screen.getByRole('button', { name: '刪除第 1 次紀錄' }));
    const cancel = await screen.findByRole('alertdialog');
    await user.click(within(cancel).getByRole('button', { name: '取消' }));
    expect(screen.getByRole('button', { name: '刪除第 1 次紀錄' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '刪除第 1 次紀錄' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: '確認刪除' }));
    await screen.findByRole('heading', { name: '還沒有每日練習履歷' });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.attempts.map((item: { id: string }) => item.id)).toEqual(['legacy-practice', 'mock-paper']);
      expect(saved.deletedAttemptIds).toContain(recorded.id);
      expect(saved.notes[question.id]).toBe('必須保留的筆記');
      expect(saved.difficultQuestionIds).toEqual([question.id]);
    });
  });

  it('explains opt-in recording rather than importing legacy automatic saves', async () => {
    renderHistory(false);
    expect(await screen.findByRole('heading', { name: '還沒有每日練習履歷' })).toBeVisible();
    expect(screen.getByText(/儲存此次作答.*才會加入履歷/)).toBeVisible();
    expect(screen.getByRole('link', { name: '歷屆試題作答履歷' })).toHaveAttribute('href', '/history');
  });

  it('excludes saved and legacy practices from paper counts and analysis without deleting them', async () => {
    const user = userEvent.setup();
    renderHistory(true, false);
    const before = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const filters = await screen.findByRole('group', { name: '歷屆試題作答履歷科目分類' });
    expect(within(filters).getByRole('button', { name: '建築法規與實務 1' })).toBeVisible();
    expect(screen.getByLabelText('114 年作答紀錄')).toHaveTextContent('共作答 1 次');
    expect(screen.queryByLabelText('每日抽題練習作答紀錄')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '跨年度錯題分析' }));
    expect(await screen.findByRole('region', { name: '跨年度錯題分析' })).toHaveTextContent('1 個年度・1 次答錯');
    await waitFor(() => {
      const after = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(after.attempts).toEqual(before.attempts);
      expect(after.deletedAttemptIds).toEqual(before.deletedAttemptIds);
      expect(after.notes).toEqual(before.notes);
    });
  });
});
