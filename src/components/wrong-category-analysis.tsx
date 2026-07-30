import { useState } from 'react';
import { QuestionPrompt } from '@/components/content/content';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import {
  formatDateTime,
  getQuestionDisplayCategory,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';
import styles from './wrong-category-analysis.module.css';

type AnalysisQuestion = Pick<
  Question,
  | 'id'
  | 'year'
  | 'questionNumber'
  | 'subject'
  | 'topic'
  | 'primaryCategory'
  | 'relatedLaws'
  | 'content'
  | 'options'
  | 'answerKey'
>;

interface AnalysisEntry {
  id: string;
  question: AnalysisQuestion;
  selectedAnswer: number;
  submittedAt: string;
}

type WrongCategoryAnalysisProps = {
  questions: readonly AnalysisQuestion[];
  title?: string;
  eyebrow?: string;
  ariaLabel?: string;
} & (
  | { attempt: QuizAttempt; attempts?: never }
  | { attempt?: never; attempts: readonly QuizAttempt[] }
);

function formatQuestionReferences(entries: readonly AnalysisEntry[]) {
  const counts = new Map<string, number>();
  entries.forEach(({ question }) => {
    const reference = `${question.year} 年第 ${question.questionNumber} 題`;
    counts.set(reference, (counts.get(reference) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([reference, count]) =>
      count > 1 ? `${reference}（${count} 次）` : reference,
    )
    .join('、');
}

export function WrongCategoryAnalysis({
  attempt,
  attempts,
  questions,
  title = '錯題類型統計',
  eyebrow = 'WRONG ANSWER ANALYSIS',
  ariaLabel = '錯題類型統計',
}: WrongCategoryAnalysisProps) {
  const sourceAttempts = attempts ?? (attempt ? [attempt] : []);
  const aggregate = attempts !== undefined;
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const categoryMap = new Map<string, AnalysisEntry[]>();
  sourceAttempts.forEach((sourceAttempt) => {
    sourceAttempt.questionIds.forEach((questionId) => {
      const question = questionById.get(questionId);
      const selectedAnswer = sourceAttempt.answers[questionId];
      if (
        !question ||
        selectedAnswer === undefined ||
        isQuestionCorrect(question, selectedAnswer)
      ) {
        return;
      }
      const category = getQuestionDisplayCategory(question);
      categoryMap.set(category, [
        ...(categoryMap.get(category) ?? []),
        {
          id: `${sourceAttempt.id}:${question.id}`,
          question,
          selectedAnswer,
          submittedAt: sourceAttempt.submittedAt,
        },
      ]);
    });
  });
  const categories = [...categoryMap.entries()].sort(
    ([leftCategory, left], [rightCategory, right]) =>
      right.length - left.length ||
      leftCategory.localeCompare(rightCategory, 'zh-Hant'),
  );
  const [selectedCategoryValue, setSelectedCategoryValue] = useState(
    categories[0]?.[0] ?? '',
  );
  const selectedCategory = categoryMap.has(selectedCategoryValue)
    ? selectedCategoryValue
    : categories[0]?.[0];
  const selectedQuestions = selectedCategory
    ? categoryMap.get(selectedCategory) ?? []
    : [];
  const wrongAnswerCount = categories.reduce(
    (total, [, entries]) => total + entries.length,
    0,
  );
  const yearCount = new Set(
    categories.flatMap(([, entries]) =>
      entries.map(({ question }) => question.year),
    ),
  ).size;

  if (!categories.length) return null;

  return (
    <section className={styles.summary} aria-label={ariaLabel}>
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <strong>
          {aggregate
            ? `${yearCount} 個年度・${wrongAnswerCount} 次答錯`
            : `${categories.length} 類`}
        </strong>
      </header>
      <div className={styles.tabs} role="tablist">
        {categories.map(([category, entries]) => (
          <button
            type="button"
            role="tab"
            key={category}
            aria-selected={category === selectedCategory}
            onClick={() => setSelectedCategoryValue(category)}
          >
            <span>
              <strong>{category}</strong>
              <small>{formatQuestionReferences(entries)}</small>
            </span>
            <b>
              {entries.length} {aggregate ? '次' : '題'}
            </b>
          </button>
        ))}
      </div>
      <div
        className={styles.panel}
        role="tabpanel"
        aria-label={`${selectedCategory}錯題`}
      >
        <header>
          <h3>{selectedCategory}</h3>
          <span>
            共 {selectedQuestions.length} {aggregate ? '次答錯' : '題'}
          </span>
        </header>
        <div>
          {selectedQuestions.map((entry) => (
            <article key={entry.id}>
              <header>
                <strong>
                  {entry.question.year} 年・第 {entry.question.questionNumber} 題
                  {aggregate ? `・${formatDateTime(entry.submittedAt)}` : ''}
                </strong>
                <span>
                  你的答案：
                  {String.fromCharCode(65 + entry.selectedAnswer)}
                </span>
              </header>
              <QuestionPrompt question={entry.question} compact />
              <QuestionAnswerPanel
                question={entry.question}
                heading={null}
                ariaLabel={`第 ${entry.question.questionNumber} 題錯題選項`}
                selectedIndex={entry.selectedAnswer}
                showStatusLabels
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
