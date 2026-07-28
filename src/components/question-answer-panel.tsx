import { useId } from 'react';
import { getAcceptedAnswerIndexes } from '@/lib/study';
import type { Question } from '@/lib/types';
import styles from './question-answer-panel.module.css';

export function QuestionAnswerPanel({
  question,
  heading = '題目選項',
  ariaLabel,
  selectedIndex,
  showStatusLabels = false,
}: {
  question: Pick<Question, 'options' | 'answerKey'>;
  heading?: string | null;
  ariaLabel?: string;
  selectedIndex?: number;
  showStatusLabels?: boolean;
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
                  ? `正確選項 ${String.fromCharCode(65 + index)}：${option}`
                  : selected
                    ? `你的答案 ${String.fromCharCode(65 + index)}：${option}`
                    : undefined
              }
            >
              <b>{String.fromCharCode(65 + index)}</b>
              <span>{option}</span>
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
