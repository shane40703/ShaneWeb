import { useState } from 'react';
import { IconCopy } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import type { Question } from '@/lib/types';

type CopyQuestion = Pick<Question, 'text' | 'options'> & Partial<Pick<Question, 'content'>>;

/** Preserve the displayed option order; images are deliberately omitted. */
export function formatQuestionForCopy(question: CopyQuestion) {
  const prompt = question.content?.filter(block => block.kind === 'text')
    .map(block => block.text.trim()).filter(Boolean).join('\n') || question.text.trim();
  return [prompt, ...question.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)]
    .filter(Boolean).join('\n');
}

export function CopyQuestionButton({ question }: { question: CopyQuestion }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(formatQuestionForCopy(question));
      setMessage('題目已複製');
    } catch {
      setMessage('複製失敗，請確認瀏覽器的剪貼簿權限。');
    }
  }
  return <span>
    <Button onClick={() => void copy()}><IconCopy size={16} aria-hidden="true" />複製題目</Button>
    {message ? <small role="status"> {message}</small> : null}
  </span>;
}
