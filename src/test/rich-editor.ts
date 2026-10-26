import { act } from '@testing-library/react';
import type { Editor } from '@tiptap/core';

/** jsdom has no editing engine; exercise the real ProseMirror commands (browser input is covered in e2e). */
export function editorOf(element: HTMLElement): Editor {
  return (element as HTMLElement & { editor: Editor }).editor;
}
export function fillRichEditor(element: HTMLElement, text: string) {
  act(() => {
    editorOf(element).commands.setContent({ type: 'doc', content: text.split('\n').map(line => ({
      type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })) });
  });
}
export function selectRichEditor(element: HTMLElement, from: number, to: number) {
  act(() => { editorOf(element).commands.setTextSelection({ from: from + 1, to: to + 1 }); });
}
