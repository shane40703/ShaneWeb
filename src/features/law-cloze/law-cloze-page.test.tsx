import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOZE_STORAGE_KEY, clozeBank, createClozeSession } from './cloze';
import { LawClozePage } from './law-cloze-page';

vi.mock('@/state/app-state', () => ({ useAppState: () => ({ reportPersistence: vi.fn() }) }));
beforeEach(() => {
  window.localStorage.clear();
  const session = createClozeSession();
  session.order = ['daylight', ...session.order.filter((id) => id !== 'daylight')];
  window.localStorage.setItem(CLOZE_STORAGE_KEY, JSON.stringify(session));
});
afterEach(cleanup);

describe('LawClozePage', () => {
  it('grades multiple blanks and reveals the entire article only after submission', async () => {
    const view = render(<LawClozePage />);
    const inputs = await screen.findAllByRole('textbox');
    expect(inputs).toHaveLength(3);
    expect(screen.queryByText('完整條文・第 41 條')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交答案' })).toBeDisabled();
    ['1/5', '0.125', '75'].forEach((value, i) => fireEvent.change(inputs[i], { target: { value } }));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    expect(screen.getByRole('status')).toHaveTextContent('本題答對 2 / 3 空');
    expect(screen.getByText('完整條文・第 41 條')).toBeInTheDocument();
    expect(screen.getByText(/正確：1\/8/)).toBeInTheDocument();
    const article = clozeBank.questions.find((q) => q.id === 'daylight')!.fullText;
    expect(document.querySelector('pre')?.textContent).toBe(article);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(CLOZE_STORAGE_KEY)!).submitted).toBe(true));
    view.unmount();
    render(<LawClozePage />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 / 3'));
    fireEvent.click(screen.getByRole('button', { name: '下一題' }));
    expect(screen.getAllByRole('textbox').every((element) => !(element as HTMLInputElement).value)).toBe(true);
    expect(screen.queryByText('完整條文・第 41 條')).not.toBeInTheDocument();
  });
});
