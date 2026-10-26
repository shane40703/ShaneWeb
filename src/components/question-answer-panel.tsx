import { useId } from 'react';
import { getAcceptedAnswerIndexes } from '@/lib/study';
import type { Question } from '@/lib/types';
import { OriginalOptionLabel, originalOptionText } from './original-option-label';
import styles from './question-answer-panel.module.css';

export function QuestionAnswerPanel({
  question,
  heading = '題目選項',
  ariaLabel,
  selectedIndex,
  showStatusLabels = false,
  originalOptionIndexes,
}: {
  question: Pick<Question, 'options' | 'answerKey'>;
  heading?: string | null;
  ariaLabel?: string;
  selectedIndex?: number;
  showStatusLabels?: boolean;
  originalOptionIndexes?: readonly number[];
}) {
  const headingId = useId();
  const acceptedAnswers = getAcceptedAnswerIndexes(question);

  return (
    <section
      className={styles.panel}
      aria-label={heading ? undefined : (ariaLabel ?? '題目選項')}
      aria-labelledby={heading ? headingId : undefined}
    >
      {heading ? <h3 id={headingId}>{heading}</h3> : null}
      <ol>
        {question.options.map((option, index) => {
          const accepted = acceptedAnswers.includes(index);
          const selected = selectedIndex === index;
          const originalIndex = originalOptionIndexes?.[index];
          const originalLabel = originalOptionText(originalIndex);
          const description = originalLabel ? `${option} ${originalLabel}` : option;
          const statusLabel =
            selected && accepted
              ? '你的答案・正確答案'
              : selected
                ? '你的答案'
                : accepted
                  ? '正確答案'
                  : null;

          return (
            <li
              key={`${index}-${option}`}
              data-accepted={accepted || undefined}
              data-selected={selected || undefined}
              aria-label={
                accepted
                  ? `正確選項 ${String.fromCharCode(65 + index)}：${description}`
                  : selected
                    ? `你的答案 ${String.fromCharCode(65 + index)}：${description}`
                    : undefined
              }
            >
              <b>{String.fromCharCode(65 + index)}</b>
              <span>
                {option}<OriginalOptionLabel index={originalIndex} />
              </span>
              {showStatusLabels && statusLabel ? (
                <small>{statusLabel}</small>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
