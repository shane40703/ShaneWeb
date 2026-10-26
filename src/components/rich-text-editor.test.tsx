import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { RichTextEditor } from './rich-text-editor';
import { editorOf, fillRichEditor, selectRichEditor } from '@/test/rich-editor';
import { parseRichDocument, richDocumentText } from '@/lib/rich-document';

afterEach(cleanup);

function Controlled({ initial = '', limit = 20000 }: { initial?: string; limit?: number }) {
  const [value, setValue] = useState(initial);
  return <><RichTextEditor value={value} onChange={setValue} ariaLabel="即時筆記" maxLength={limit} /><output aria-label="存檔值">{value}</output></>;
}

describe('RichTextEditor', () => {
  it('opens legacy notes as visible nested formatting, without changing stored content on mount', () => {
    const change = vi.fn();
    render(<RichTextEditor value="**舊筆記** !!0.75m^2^!!" onChange={change} ariaLabel="即時筆記" />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    expect(editor.querySelector('strong')).toHaveTextContent('舊筆記');
    expect(editor.querySelector('sup')).toHaveTextContent('2');
    expect(editor).not.toHaveTextContent('**');
    expect(change).not.toHaveBeenCalled();
  });

  it('toggles formatting on the selected text, combines colour and size, and excludes simultaneous sup/subscript', () => {
    render(<Controlled />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fillRichEditor(editor, '即時效果');
    selectRichEditor(editor, 0, 4);
    const bold = screen.getByRole('button', { name: '切換選取文字的粗體格式' });
    fireEvent.click(bold);
    expect(editor.querySelector('strong')).toHaveTextContent('即時效果');
    expect(bold).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(bold);
    expect(editor.querySelector('strong')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: '文字顏色' }), { target: { value: 'var(--danger)' } });
    fireEvent.change(screen.getByRole('combobox', { name: '文字大小' }), { target: { value: '24px' } });
    expect(editor.querySelector('[style]')).toHaveStyle({ color: 'var(--danger)', fontSize: '24px' });
    fireEvent.click(screen.getByRole('button', { name: '切換選取文字的上標格式' }));
    expect(editor.querySelector('sup')).toHaveTextContent('即時效果');
    fireEvent.click(screen.getByRole('button', { name: '切換選取文字的下標格式' }));
    expect(editor.querySelector('sup')).toBeNull();
    expect(editor.querySelector('sub')).toHaveTextContent('即時效果');
    expect(richDocumentText(parseRichDocument(screen.getByLabelText('存檔值').textContent!)!)).toBe('即時效果');
    fireEvent.click(screen.getByRole('button', { name: '清除格式' }));
    expect(editor.querySelector('sub, [style]')).toBeNull();
  });

  it('preserves content and explains the storage limit instead of silently dropping overflowing input', () => {
    render(<Controlled limit={200} />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fillRichEditor(editor, '保留原文');
    fillRichEditor(editor, 'x'.repeat(300));
    expect(editor).toHaveTextContent('保留原文');
    expect(screen.getByRole('alert')).toHaveTextContent('已達儲存長度上限');
    fillRichEditor(editor, '短文');
    expect(editor).toHaveTextContent('短文');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fillRichEditor(editor, '');
    expect(screen.getByLabelText('存檔值')).toHaveTextContent('');
  });

  it('discards unsafe or oversized pasted HTML styles and unsafe URLs before they enter saved content', () => {
    render(<Controlled />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    act(() => { editorOf(editor).commands.setContent('<p><span style="font-size:9999px;color:rgb(18,52,255)">安全文字</span><a href="javascript:alert(1)">連結</a><script>alert(1)</script></p>'); });
    expect(editor.querySelector('script, a')).toBeNull();
    expect(editor.querySelector('[style]')).toHaveStyle({ color: 'rgb(18, 52, 255)' });
    expect(editor.querySelector('[style*="font-size"]')).toBeNull();
    expect(screen.getByLabelText('存檔值')).not.toHaveTextContent('9999px');
  });

  it('accepts external resets without reporting them as edits and supports disabled content', () => {
    const change = vi.fn();
    const view = render(<RichTextEditor value="舊內容" onChange={change} ariaLabel="即時筆記" />);
    view.rerender(<RichTextEditor value="**新內容**" onChange={change} ariaLabel="即時筆記" disabled />);
    expect(screen.getByRole('textbox', { name: '即時筆記' })).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('textbox', { name: '即時筆記' }).querySelector('strong')).toHaveTextContent('新內容');
    expect(screen.getByRole('button', { name: '切換選取文字的粗體格式' })).toBeDisabled();
    expect(change).not.toHaveBeenCalled();
  });
});
