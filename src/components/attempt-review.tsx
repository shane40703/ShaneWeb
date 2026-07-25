import Link from 'next/link';
import {
  IconChevronDown,
  IconCircleCheck,
  IconMessages,
  IconMinus,
  IconX,
} from '@tabler/icons-react';
import { QuestionPrompt } from '@/components/content/content';
import { formatCorrectAnswer, isQuestionCorrect } from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';
import styles from './attempt-review.module.css';

type ReviewQuestion = Pick<
  Question,
  'id' | 'year' | 'questionNumber' | 'text' | 'options' | 'answerKey'
> &
  Partial<Pick<Question, 'content'>>;

export function AttemptReview({
  attempt,
  questions,
  embedded = false,
}: {
  attempt: QuizAttempt;
  questions: readonly ReviewQuestion[];
  embedded?: boolean;
}) {
  return (
    <section
      className={styles.reviewSection}
      data-embedded={embedded || undefined}
      aria-label="完整作答紀錄"
    >
      <header className={styles.reviewHeader}>
        <div>
          <span>完整對答案</span>
          <h2>逐題作答結果</h2>
        </div>
        <strong>共 {questions.length} 題</strong>
      </header>
      <div className={styles.reviewList}>
        {questions.map((question, index) => {
          const selected = attempt.answers[question.id];
          const selectedAnswer =
            selected === undefined
              ? '未作答'
              : String.fromCharCode(65 + selected);
          const questionCorrect = isQuestionCorrect(question, selected);
          const result =
            selected === undefined && question.answerKey.kind !== 'all-credit'
              ? 'unanswered'
              : questionCorrect
                ? 'correct'
                : 'wrong';
          return (
            <article key={question.id} data-result={result}>
              <span
                className={styles.reviewStatus}
                aria-label={
                  result === 'correct'
                    ? '答對'
                    : result === 'wrong'
                      ? '答錯'
                      : '未作答'
                }
              >
                {result === 'correct' ? (
                  <IconCircleCheck size={19} stroke={2.2} aria-hidden="true" />
                ) : result === 'wrong' ? (
                  <IconX size={19} stroke={2.2} aria-hidden="true" />
                ) : (
                  <IconMinus size={19} stroke={2.2} aria-hidden="true" />
                )}
              </span>
              <div className={styles.reviewContent}>
                <span>
                  {index + 1}. {question.year} 年・第 {question.questionNumber} 題
                </span>
                {question.content ? (
                  <div className={styles.reviewPrompt}>
                    <QuestionPrompt
                      question={{ content: question.content }}
                      compact
                    />
                  </div>
                ) : (
                  <strong>{question.text || '圖片題目'}</strong>
                )}
                <p>
                  你的答案：{selectedAnswer}
                  <b>標準答案：{formatCorrectAnswer(question)}</b>
                </p>
              </div>
              <details className={styles.reviewOptions}>
                <summary>
                  <span>檢視完整選項</span>
                  <IconChevronDown size={17} stroke={2} aria-hidden="true" />
                </summary>
                <div className={styles.reviewOptionList}>
                  {question.options.map((option, optionIndex) => {
                    const optionSelected = selected === optionIndex;
                    const accepted =
                      question.answerKey.kind === 'all-credit' ||
                      question.answerKey.options.includes(optionIndex);

                    return (
                      <div
                        key={`${question.id}-${optionIndex}`}
                        data-selected={optionSelected || undefined}
                        data-accepted={accepted || undefined}
                      >
                        <b>{String.fromCharCode(65 + optionIndex)}</b>
                        <span>{option}</span>
                        <small>
                          {optionSelected && accepted
                            ? '你的答案・正確答案'
                            : optionSelected
                              ? '你的答案'
                              : accepted
                                ? '正確答案'
                                : ''}
                        </small>
                      </div>
                    );
                  })}
                </div>
                <footer>
                  <Link href={`/community?question=${question.id}`}>
                    詳解與討論
                    <IconMessages size={16} stroke={2} aria-hidden="true" />
                  </Link>
                </footer>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
