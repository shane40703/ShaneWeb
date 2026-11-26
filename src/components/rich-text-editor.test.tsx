import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { RichTextEditor } from './rich-text-editor';
import { editorOf, fillRichEditor, selectRichEditor } from '@/test/rich-editor';
import { parseRichDocument, richDocumentText, serializeRichDocument, toRichDocument } from '@/lib/rich-document';

afterEach(cleanup);

function Controlled({ initial = '', limit = 20000 }: { initial?: string; limit?: number }) {
  const [value, setValue] = useState(initial);
  return <><RichTextEditor value={value} onChange={setValue} ariaLabel="即時筆記" maxLength={limit} /><output aria-label="存檔值">{value}</output></>;
}

describe('RichTextEditor', () => {
  it.each(['**已儲存的舊筆記**', serializeRichDocument(toRichDocument('!!已儲存的格式筆記!!'))])(
    'hides the placeholder immediately when opening saved content without focusing it: %s', initial => {
      render(<Controlled initial={initial} />);
      expect(screen.getByRole('textbox', { name: '即時筆記' })).toHaveAttribute('data-empty', 'false');
    },
  );

  it('updates the placeholder from the document through typing, undo, redo and clearing', () => {
    render(<Controlled />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    expect(editor).toHaveAttribute('data-empty', 'true');
    fillRichEditor(editor, '已有文字');
    expect(editor).toHaveAttribute('data-empty', 'false');
    act(() => { editorOf(editor).commands.undo(); });
    expect(editor).toHaveAttribute('data-empty', 'true');
    act(() => { editorOf(editor).commands.redo(); });
    expect(editor).toHaveAttribute('data-empty', 'false');
    fillRichEditor(editor, '');
    expect(editor).toHaveAttribute('data-empty', 'true');
  });

  it('updates the placeholder on silent external content replacements', () => {
    const change = vi.fn();
    const view = render(<RichTextEditor value="" onChange={change} ariaLabel="即時筆記" />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    expect(editor).toHaveAttribute('data-empty', 'true');
    view.rerender(<RichTextEditor value="外部載入的筆記" onChange={change} ariaLabel="即時筆記" />);
    expect(editor).toHaveAttribute('data-empty', 'false');
    view.rerender(<RichTextEditor value="" onChange={change} ariaLabel="即時筆記" />);
    expect(editor).toHaveAttribute('data-empty', 'true');
    expect(change).not.toHaveBeenCalled();
  });

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

  it('pastes plain text without clipboard formatting while preserving line breaks and whitespace', () => {
    render(<Controlled />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fireEvent.paste(editor, { clipboardData: {
      files: [],
      getData: (type: string) => type === 'text/plain' ? '第一行\n\n  第二行' : '<p><strong>第一行</strong></p><p style="color:red">第二行</p>',
    } });
    expect(editor.querySelector('strong, em, a, [style]')).toBeNull();
    expect(richDocumentText(parseRichDocument(screen.getByLabelText('存檔值').textContent!)!)).toBe('第一行\n\n  第二行');
  });

  it('extracts unformatted text from an HTML-only clipboard', () => {
    render(<Controlled />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fireEvent.paste(editor, { clipboardData: {
      files: [],
      getData: (type: string) => type === 'text/html'
        ? '<p><strong>第一行</strong></p><p style="color:red">第二行<br>第三行</p><script>不應加入</script>'
        : '',
    } });
    expect(editor.querySelector('strong, [style], script')).toBeNull();
    expect(richDocumentText(parseRichDocument(screen.getByLabelText('存檔值').textContent!)!)).toBe('第一行\n第二行\n第三行');
  });

  it('does not inherit formatting at the insertion point and leaves surrounding text unchanged', () => {
    render(<Controlled initial="**前後**" />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    selectRichEditor(editor, 1, 1);
    fireEvent.paste(editor, { clipboardData: { files: [], getData: () => '貼入' } });
    expect(editor).toHaveTextContent('前貼入後');
    expect(Array.from(editor.querySelectorAll('strong'), node => node.textContent)).toEqual(['前', '後']);
    expect(richDocumentText(parseRichDocument(screen.getByLabelText('存檔值').textContent!)!)).toBe('前貼入後');
  });

  it('pastes a URL as text without automatically adding link formatting', () => {
    render(<Controlled />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fireEvent.paste(editor, { clipboardData: { files: [], getData: () => 'https://example.com' } });
    expect(editor).toHaveTextContent('https://example.com');
    expect(editor.querySelector('a')).toBeNull();
  });

  it('keeps image attachments and text when both are pasted together', () => {
    const onPasteImages = vi.fn();
    const onChange = vi.fn();
    render(<RichTextEditor value="" onChange={onChange} ariaLabel="即時筆記" onPasteImages={onPasteImages} />);
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fireEvent.paste(editor, { clipboardData: { files: [file], getData: () => '附圖說明' } });
    expect(onPasteImages).toHaveBeenCalledWith([file]);
    expect(editor).toHaveTextContent('附圖說明');
    expect(onChange).toHaveBeenCalled();
  });

  it('preserves image-only pasting without altering existing text', () => {
    const onPasteImages = vi.fn();
    render(<RichTextEditor value="原有內容" onChange={vi.fn()} ariaLabel="即時筆記" onPasteImages={onPasteImages} />);
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fireEvent.paste(editor, { clipboardData: { files: [file], getData: () => '' } });
    expect(onPasteImages).toHaveBeenCalledWith([file]);
    expect(editor).toHaveTextContent('原有內容');
  });

  it('still enforces the storage limit on pasted text', () => {
    render(<Controlled initial="保留原文" limit={200} />);
    const editor = screen.getByRole('textbox', { name: '即時筆記' });
    fireEvent.paste(editor, { clipboardData: { files: [], getData: () => 'x'.repeat(300) } });
    expect(editor).toHaveTextContent('保留原文');
    expect(screen.getByRole('alert')).toHaveTextContent('已達儲存長度上限');
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
