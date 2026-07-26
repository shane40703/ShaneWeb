import { useId } from 'react';
import { getAcceptedAnswerIndexes } from '@/lib/study';
import type { Question } from '@/lib/types';
import styles from './question-answer-panel.module.css';

export function QuestionAnswerPanel({
  question,
}: {
  question: Pick<Question, 'options' | 'answerKey'>;
}) {
  const headingId = useId();
  const acceptedAnswers = getAcceptedAnswerIndexes(question);

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 id={headingId}>題目選項</h3>
      <ol>
        {question.options.map((option, index) => {
          const accepted = acceptedAnswers.includes(index);

          return (
            <li
              key={`${index}-${option}`}
              data-accepted={accepted || undefined}
              aria-label={
                accepted
                  ? `正確選項 ${String.fromCharCode(65 + index)}：${option}`
                  : undefined
              }
            >
              <b>{String.fromCharCode(65 + index)}</b>
              <span>{option}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
