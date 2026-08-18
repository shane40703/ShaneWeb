import type { ReactNode, RefObject } from 'react';
import { toggleTextFormatting, type TextFormat } from '@/lib/text-formatting';
import styles from './text-formatting-toolbar.module.css';

const actions: Array<{ format: TextFormat; label: string; content: ReactNode }> = [
  { format: 'bold', label: '粗體', content: <strong>B</strong> },
  { format: 'italic', label: '斜體', content: <em>I</em> },
  { format: 'superscript', label: '上標', content: <>X<sup>2</sup></> },
  { format: 'subscript', label: '下標', content: <>X<sub>2</sub></> },
  { format: 'red', label: '紅字', content: '紅字' },
];

export function TextFormattingToolbar({
  textareaRef,
  value,
  onChange,
  ariaContext = '',
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  ariaContext?: string;
}) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label={`${ariaContext || '文字'}格式`}>
      {actions.map((action) => (
        <button
          key={action.format}
          type="button"
          data-format={action.format}
          aria-label={`切換${ariaContext}選取文字的${action.label}格式`}
          onClick={() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            const scrollTop = textarea.scrollTop;
            const scrollLeft = textarea.scrollLeft;
            const result = toggleTextFormatting(
              value,
              textarea.selectionStart,
              textarea.selectionEnd,
              action.format,
            );
            onChange(result.value);
            requestAnimationFrame(() => {
              textarea.focus({ preventScroll: true });
              textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
              textarea.scrollTop = scrollTop;
              textarea.scrollLeft = scrollLeft;
            });
          }}
        >
          {action.content}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
