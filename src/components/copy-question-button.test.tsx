import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
});
