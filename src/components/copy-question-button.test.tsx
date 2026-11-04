import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/ui';
import { CopyQuestionButton, formatQuestionForCopy } from './copy-question-button';

const question = {
  text: '備用題目',
  content: [
    { kind: 'text' as const, text: '第一段' },
    { kind: 'image' as const, src: '/question.png', alt: '圖片', width: 10, height: 10 },
    { kind: 'text' as const, text: '第二段' },
  ],
  options: ['選項二', '選項一'],
};

/** jsdom has no copy command; each test that needs one decides what it returns. */
function stubCopyCommand(copy: () => boolean) {
  const execCommand = vi.fn(copy);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  return execCommand;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); Reflect.deleteProperty(document, 'execCommand'); });

describe('copy question', () => {
  it('copies all text and displayed options, without the image', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyQuestionButton question={question} />);
    fireEvent.click(screen.getByRole('button', { name: '複製題目' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('第一段\n第二段\nA. 選項二\nB. 選項一'));
    expect(await screen.findByRole('status')).toHaveTextContent('題目已複製');
    expect(formatQuestionForCopy({ text: '申論題', options: [] })).toBe('申論題');
  });

  it('reports clipboard permission failures', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<CopyQuestionButton question={question} />);
    fireEvent.click(screen.getByRole('button', { name: '複製題目' }));
    expect(await screen.findByRole('status')).toHaveTextContent('複製失敗');
  });

  it('turns into 已複製 for 2 seconds while its name stays 複製題目', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CopyQuestionButton question={question} />);
    const button = screen.getByRole('button', { name: '複製題目' });
    await act(async () => { fireEvent.click(button); });
    expect(screen.getByText('已複製')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText('複製題目')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: '複製題目' })).toBe(button);
    expect(screen.getByRole('status')).toHaveTextContent('題目已複製');
    act(() => { vi.advanceTimersByTime(1500); });
    // Copying again restarts the 2 seconds.
    await act(async () => { fireEvent.click(button); });
    act(() => { vi.advanceTimersByTime(1999); });
    expect(screen.getByText('已複製')).not.toHaveAttribute('aria-hidden');
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByText('複製題目')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText('已複製')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('falls back to the copy command when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    let copied = '';
    const execCommand = stubCopyCommand(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    });
    render(<CopyQuestionButton question={question} />);
    const button = screen.getByRole('button', { name: '複製題目' });
    button.focus();
    fireEvent.click(button);
    expect(await screen.findByRole('status')).toHaveTextContent('題目已複製');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(copied).toBe('第一段\n第二段\nA. 選項二\nB. 選項一');
    expect(document.querySelector('textarea')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('explains a failure in the toast when one is available', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    stubCopyCommand(() => false);
    render(<ToastProvider><CopyQuestionButton question={question} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: '複製題目' }));
    const toast = await screen.findByRole('dialog');
    expect(toast).toHaveTextContent('複製失敗');
    expect(toast).toHaveTextContent('請確認瀏覽器允許這個網站使用剪貼簿，再試一次。');
    expect(screen.getAllByText('複製失敗').find(label => label.closest('button'))).not.toHaveAttribute('aria-hidden');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
