import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import type { Question } from '@/lib/types';
import { createPracticeSessionFromQuestions, PRACTICE_SESSION_STORAGE_KEY } from './practice-session';
import { SubjectPracticeButton } from './subject-practice-button';

const mocks = vi.hoisted(() => ({ push: vi.fn(async () => true), reportPersistence: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/state/app-state', () => ({ useAppState: () => ({ reportPersistence: mocks.reportPersistence }) }));

const question: Question = {
  id: 'law-114-01', subject: 'law', year: 114, questionNumber: 1,
  topic: '測試', primaryCategory: '測試', tags: [], text: '題幹', content: [{ kind: 'text', text: '題幹' }],
  options: ['甲', '乙'], answerKey: { kind: 'accepted', options: [0] }, source: { kind: 'sample' },
};

function renderButton(props: Partial<React.ComponentProps<typeof SubjectPracticeButton>> = {}) {
  return render(<ToastProvider><SubjectPracticeButton questions={[question]} subject="law" source="difficult" {...props} /></ToastProvider>);
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SubjectPracticeButton', () => {
  it('does not replace progress when the user declines, and starts only after consent', async () => {
    const current = createPracticeSessionFromQuestions([question], 'law', false);
    current.drafts[question.id] = 1;
    const original = JSON.stringify(current);
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, original);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: '作答本科目所有難題標記' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe(original);
    expect(mocks.push).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '作答本科目所有難題標記' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/practice/quiz?q=1'));
    expect(JSON.parse(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)!)).toMatchObject({ reviewSource: 'difficult', drafts: {}, answers: {} });
  });

  it('does not navigate when storage is full, preserving the existing saved set', () => {
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, 'existing');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    renderButton({ source: 'wrong' });
    fireEvent.click(screen.getByRole('button', { name: '作答本科目所有常錯題目' }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe('existing');
    expect(mocks.reportPersistence).toHaveBeenCalledWith('practice-session', 'quota-exceeded');
  });

  it('disables incomplete banks and subjects without playable questions', () => {
    const view = renderButton({ loading: true });
    expect(screen.getByRole('button')).toBeDisabled();
    view.unmount();
    renderButton({ questions: [{ ...question, format: 'written', answerKey: { kind: 'written' }, options: [] }] });
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('跨所有年度・共 0 題選擇題')).toBeInTheDocument();
  });
});
