import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/components/rich-text-editor-lazy');

afterEach(cleanup);

describe('RichTextEditorLoading', () => {
  it('says the editor is on its way', async () => {
    const { RichTextEditorLoading } = await import('@/components/rich-text-editor-lazy');
    render(<RichTextEditorLoading />);

    expect(screen.getByText('正在準備編輯器…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('gives a way out when its code never arrives', async () => {
    const { RichTextEditorLoading } = await import('@/components/rich-text-editor-lazy');
    render(<RichTextEditorLoading error={new Error('chunk failed')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('編輯器載入失敗');
    expect(screen.getByRole('button', { name: '重新整理' })).toBeInTheDocument();
  });
});
