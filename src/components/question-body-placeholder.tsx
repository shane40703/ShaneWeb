import type { ReactNode } from 'react';
import { EmptyState } from '@/components/content/content';
import { Button } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { useFilledBodies } from '@/lib/question-bank-client';
import type { Question } from '@/lib/types';

/** Where a question's text will be: reading, or why it cannot be read. */
export function QuestionBodyPlaceholder({
  status,
  onRetry,
}: {
  status: QuestionBankStatus;
  onRetry: () => void;
}) {
  return status === 'error' ? (
    <EmptyState
      title="題目暫時無法顯示"
      description="作答紀錄不受影響，請確認連線後再試一次。"
      action={<Button onClick={onRetry}>重新載入</Button>}
    />
  ) : (
    <p role="status">正在載入題目內容…</p>
  );
}

/** Renders a list of questions once all their bodies are here. */
export function WithQuestionBodies({
  questions,
  children,
}: {
  questions: readonly Question[];
  children: (questions: Question[]) => ReactNode;
}) {
  const { bodyOf, status, retry } = useFilledBodies(questions);
  const filled = questions.flatMap((question) => bodyOf(question) ?? []);
  return filled.length === questions.length ? (
    children(filled)
  ) : (
    <QuestionBodyPlaceholder status={status} onRetry={retry} />
  );
}
