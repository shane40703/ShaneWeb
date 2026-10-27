import { QuestionExplanationContent } from '@/components/question-explanation-content';
import { formatCorrectAnswer } from '@/lib/study';
import type { Question } from '@/lib/types';
import styles from './practice-page.module.css';

/** The built-in explanation plus the community posts that explain the answer. */
export function PracticeExplanation({
  question,
  selectedIndex,
  showAnswers = true,
}: {
  question: Question;
  selectedIndex: number;
  /** Off where a result banner above already states both answers. */
  showAnswers?: boolean;
}) {
  return (
    <section
      className={styles.explanation}
      aria-label={`原題第 ${question.questionNumber} 題詳解`}
    >
      <strong>
        {showAnswers ? `正確答案：${formatCorrectAnswer(question)}` : '詳解'}
      </strong>
      <QuestionExplanationContent question={question}
        emptyMessage="本題目前尚無詳解，請比較正確選項與題幹條件。" />
      {showAnswers ? (
        <span className={styles.answerSummary}>
          你的答案：{String.fromCharCode(65 + selectedIndex)}
        </span>
      ) : null}
    </section>
  );
}
