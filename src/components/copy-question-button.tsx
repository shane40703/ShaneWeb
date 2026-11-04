import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconCheck, IconCopy } from '@tabler/icons-react';
import { Button, useOptionalToast } from '@/components/ui/ui';
import type { Question } from '@/lib/types';
import styles from './copy-question-button.module.css';

type CopyQuestion = Pick<Question, 'text' | 'options'> & Partial<Pick<Question, 'content'>>;

/** Preserve the displayed option order; images are deliberately omitted. */
export function formatQuestionForCopy(question: CopyQuestion) {
  const prompt = question.content?.filter(block => block.kind === 'text')
    .map(block => block.text.trim()).filter(Boolean).join('\n') || question.text.trim();
  return [prompt, ...question.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)]
    .filter(Boolean).join('\n');
}

type CopyState = 'idle' | 'copied' | 'failed';

const copyStates = ['idle', 'copied', 'failed'] as const satisfies readonly CopyState[];
const labels = { idle: '複製題目', copied: '已複製', failed: '複製失敗' } satisfies Record<CopyState, string>;
const icons = { idle: IconCopy, copied: IconCheck, failed: IconAlertTriangle } satisfies Record<CopyState, typeof IconCopy>;
/** How long a result stays on the button before it reads 複製題目 again. */
const resultDuration = { copied: 2000, failed: 4000 };

/** The older copy command, for browsers without the Clipboard API or when it refuses. */
function copyWithTextarea(text: string, button: HTMLElement) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  // 16px keeps iOS from zooming in when the field takes focus.
  textarea.style.cssText = 'position: fixed; top: 0; left: -9999px; font-size: 16px;';
  document.body.append(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    button.focus({ preventScroll: true });
  }
}

async function writeToClipboard(text: string, button: HTMLElement) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or the page lost focus: try the copy command once.
  }
  return copyWithTextarea(text, button);
}

/**
 * The button is its own confirmation: 已複製 with a check for 2 s, or a red 複製失敗 for 4 s.
 * Its width and its accessible name (複製題目) never change, so nothing beside it moves.
 */
export function CopyQuestionButton({ question }: { question: CopyQuestion }) {
  const [state, setState] = useState<CopyState>('idle');
  // Copying again while 已複製 shows restarts its 2 s.
  const [attempt, setAttempt] = useState(0);
  const toast = useOptionalToast();

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), resultDuration[state]);
    return () => clearTimeout(timer);
  }, [state, attempt]);

  async function copy(button: HTMLElement) {
    const copied = await writeToClipboard(formatQuestionForCopy(question), button);
    if (!copied) toast?.notify('複製失敗', '請確認瀏覽器允許這個網站使用剪貼簿，再試一次。', 'error');
    setState(copied ? 'copied' : 'failed');
    setAttempt(count => count + 1);
  }

  // Rendered only while there is something to say; with a toast, the toast says the failure.
  const announcement = state === 'copied' ? '題目已複製'
    : state === 'failed' && !toast ? '複製失敗，請確認瀏覽器的剪貼簿權限。' : '';
  const faceClass = (key: CopyState) =>
    [styles.face, key !== state && styles.inactive, key === 'failed' && styles.failed].filter(Boolean).join(' ');

  return <span>
    <Button aria-label={labels.idle} data-copy-state={state} onClick={event => void copy(event.currentTarget)}>
      <span className={styles.faces}>
        {copyStates.map(key => {
          const Icon = icons[key];
          return <span key={key} className={faceClass(key)} aria-hidden={key === state ? undefined : true}>
            <Icon size={16} aria-hidden="true" className={key === 'copied' && state === 'copied' ? styles.arrive : undefined} />
            {labels[key]}
          </span>;
        })}
      </span>
    </Button>
    {announcement ? <span role="status" className={styles.status}>{announcement}</span> : null}
  </span>;
}
