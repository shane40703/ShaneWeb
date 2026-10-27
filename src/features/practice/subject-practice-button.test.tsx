import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import type { Question } from '@/lib/types';
import { createPracticeSessionFromQuestions, parsePracticeSession, PRACTICE_SESSION_STORAGE_KEY } from './practice-session';
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

async function openSettings(source: 'difficult' | 'wrong' = 'difficult') {
  fireEvent.click(screen.getByRole('button', { name: source === 'difficult' ? '作答本科目所有難題標記' : '作答本科目所有常錯題目' }));
  return screen.findByRole('dialog', { name: source === 'difficult' ? '難題標記重練設定' : '常錯題目重練設定' });
}

function bank(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...question, id: `law-${index % 2 ? 113 : 114}-${index + 1}`, year: index % 2 ? 113 : 114, questionNumber: index + 1,
  }));
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('SubjectPracticeButton', () => {
  it('opens settings without replacing anything, and cancel restores trigger focus', async () => {
    const user = userEvent.setup();
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, 'keep-current-set');
    const confirm = vi.spyOn(window, 'confirm');
    renderButton();
    await openSettings();
    expect(screen.getByRole('spinbutton', { name: '本次題數' })).toHaveValue(1);
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe('keep-current-set');
    expect(confirm).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: '作答本科目所有難題標記' })).toHaveFocus());
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe('keep-current-set');
  });

  it('does not replace progress when the user declines, and starts only after consent', async () => {
    const current = createPracticeSessionFromQuestions([question], 'law', false);
    current.drafts[question.id] = 1;
    const original = JSON.stringify(current);
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, original);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderButton();
    await openSettings();
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^開始練習/ }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe(original);
    expect(mocks.push).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /^開始練習/ }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/practice/quiz?q=1'));
    expect(JSON.parse(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)!)).toMatchObject({ reviewSource: 'difficult', drafts: {}, answers: {} });
  });

  it('does not navigate when storage is full, preserving the existing saved set', async () => {
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, 'existing');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    renderButton({ source: 'wrong' });
    await openSettings('wrong');
    fireEvent.click(screen.getByRole('button', { name: /^開始練習/ }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe('existing');
    expect(mocks.reportPersistence).toHaveBeenCalledWith('practice-session', 'quota-exceeded');
  });

  it.each(['difficult', 'wrong'] as const)('samples the custom count from only this subject for %s', async source => {
    const candidates = bank(67);
    const supplied = [...candidates, candidates[0], { ...question, id: 'env-114-01', subject: 'env' as const },
      { ...question, id: 'law-114-written', format: 'written' as const, answerKey: { kind: 'written' as const }, options: [] }];
    renderButton({ questions: supplied, source });
    await openSettings(source);
    expect(screen.getByRole('spinbutton', { name: '本次題數' })).toHaveValue(50);
    fireEvent.change(screen.getByRole('spinbutton', { name: '本次題數' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('checkbox', { name: '打亂選項順序' }));
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    fireEvent.click(screen.getByRole('button', { name: '開始練習（7 題）' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/practice/quiz?q=1'));
    const saved = parsePracticeSession(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY))!;
    expect(saved.questionIds).toHaveLength(7);
    expect(new Set(saved.questionIds).size).toBe(7);
    expect(saved.questionIds.every(id => candidates.some(item => item.id === id))).toBe(true);
    expect(saved.questionIds).not.toEqual(candidates.slice(0, 7).map(item => item.id));
    expect(saved.reviewSource).toBe(source);
    expect(saved.optionOrders).toEqual({});
    expect(supplied).toHaveLength(70);
  });

  it('defaults to 50 rather than starting the entire large subject', async () => {
    renderButton({ questions: bank(67) });
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: '開始練習（50 題）' }));
    expect(parsePracticeSession(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY))!.questionIds).toHaveLength(50);
  });

  it('keeps an explicit all option beyond 50 questions and preserves the original order', async () => {
    const candidates = bank(67);
    renderButton({ questions: candidates });
    await openSettings();
    fireEvent.click(screen.getByRole('button', { name: '5 題' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
    fireEvent.click(screen.getByRole('button', { name: '全部（67 題）' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(67);
    fireEvent.click(screen.getByRole('button', { name: '開始練習（67 題）' }));
    const saved = parsePracticeSession(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY))!;
    expect(saved.questionIds).toEqual([...candidates].sort((a, b) => b.year - a.year || a.questionNumber - b.questionNumber).map(item => item.id));
    expect(Object.keys(saved.optionOrders)).toHaveLength(67);
  });

  it.each(['', '0', '-1', '1.5', '4'])('rejects the invalid count %j without replacing progress', async value => {
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, 'keep-current-set');
    renderButton({ questions: bank(3) });
    await openSettings();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value } });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: /^開始練習/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('請輸入 1～3 的整數題數。');
    fireEvent.submit(screen.getByRole('spinbutton').closest('form')!);
    expect(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY)).toBe('keep-current-set');
    expect(mocks.push).not.toHaveBeenCalled();
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
