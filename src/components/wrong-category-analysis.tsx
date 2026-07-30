import { useState } from 'react';
import { QuestionPrompt } from '@/components/content/content';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import {
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

export function WrongCategoryAnalysis({
  attempt,
  questions,
}: {
  attempt: QuizAttempt;
  questions: readonly AnalysisQuestion[];
}) {
  const categoryMap = new Map<string, AnalysisQuestion[]>();
  questions.forEach((question) => {
    const selectedAnswer = attempt.answers[question.id];
    if (
      selectedAnswer === undefined ||
      isQuestionCorrect(question, selectedAnswer)
    ) {
      return;
    }
    const category = getQuestionDisplayCategory(question);
    categoryMap.set(category, [
      ...(categoryMap.get(category) ?? []),
      question,
    ]);
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

  if (!categories.length) return null;

  return (
    <section className={styles.summary} aria-label="錯題類型統計">
      <header>
        <div>
          <span>WRONG ANSWER ANALYSIS</span>
          <h2>錯題類型統計</h2>
        </div>
        <strong>{categories.length} 類</strong>
      </header>
      <div className={styles.tabs} role="tablist">
        {categories.map(([category, categoryQuestions]) => (
          <button
            type="button"
            role="tab"
            key={category}
            aria-selected={category === selectedCategory}
            onClick={() => setSelectedCategoryValue(category)}
          >
            <span>
              <strong>{category}</strong>
              <small>
                {categoryQuestions
                  .map(
                    (question) =>
                      `${question.year} 年第 ${question.questionNumber} 題`,
                  )
                  .join('、')}
              </small>
            </span>
            <b>{categoryQuestions.length} 題</b>
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
          <span>共 {selectedQuestions.length} 題</span>
        </header>
        <div>
          {selectedQuestions.map((question) => (
            <article key={question.id}>
              <header>
                <strong>
                  {question.year} 年・第 {question.questionNumber} 題
                </strong>
                <span>
                  你的答案：
                  {String.fromCharCode(65 + attempt.answers[question.id])}
                </span>
              </header>
              <QuestionPrompt question={question} compact />
              <QuestionAnswerPanel
                question={question}
                heading={null}
                ariaLabel={`第 ${question.questionNumber} 題錯題選項`}
                selectedIndex={attempt.answers[question.id]}
                showStatusLabels
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
