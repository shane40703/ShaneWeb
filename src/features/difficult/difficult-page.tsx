import {
  EmptyState,
  QuestionCard,
  QuestionPrompt,
  QuestionSourceLine,
} from '@/components/content/content';
import { IconBulb, IconChevronDown, IconLoader2 } from '@tabler/icons-react';
import { getAcceptedAnswerIndexes } from '@/lib/study';
import type { Question } from '@/lib/types';
import { subjects } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import styles from './difficult-page.module.css';

function groupDifficultQuestions(questions: Question[]) {
  return subjects.flatMap((subject) => {
    const subjectQuestions = questions.filter(
      (question) => question.subject === subject.id,
    );
    if (!subjectQuestions.length) return [];

    const yearGroups = [...new Set(subjectQuestions.map((question) => question.year))]
      .sort((left, right) => right - left)
      .map((year) => ({
        year,
        questions: subjectQuestions
          .filter((question) => question.year === year)
          .sort((left, right) => left.questionNumber - right.questionNumber),
      }));

    return [{ subject, questions: subjectQuestions, yearGroups }];
  });
}

export function DifficultPage({ questions }: { questions: Question[] }) {
  const { state, dispatch, hydrated } = useAppState();
  const difficultQuestions = questions.filter((question) =>
    state.difficultQuestionIds.includes(question.id),
  );
  const subjectGroups = groupDifficultQuestions(difficultQuestions);

  return (
    <section className={styles.panel}>
      {!hydrated ? (
        <EmptyState icon={IconLoader2} title="正在讀取難題" description="請稍候。" />
      ) : subjectGroups.length ? (
        <div className={styles.subjectList}>
          {subjectGroups.map(({ subject, questions: groupedQuestions, yearGroups }) => (
            <section
              className={styles.subjectGroup}
              aria-labelledby={`difficult-subject-${subject.id}`}
              key={subject.id}
            >
              <header className={styles.subjectHeader}>
                <h2 id={`difficult-subject-${subject.id}`}>{subject.name}</h2>
                <span>{groupedQuestions.length} 題難題</span>
              </header>
              <div className={styles.yearList}>
                {yearGroups.map(({ year, questions: yearQuestions }) => (
                  <section
                    className={styles.yearGroup}
                    aria-labelledby={`difficult-year-${subject.id}-${year}`}
                    key={year}
                  >
                    <header className={styles.yearHeader}>
                      <h3 id={`difficult-year-${subject.id}-${year}`}>
                        {year} 年
                      </h3>
                      <span>{yearQuestions.length} 題</span>
                    </header>
                    <div className={styles.questionList}>
                      {yearQuestions.map((question) => {
                        const acceptedAnswers =
                          getAcceptedAnswerIndexes(question);

                        return (
                          <article
                            className={styles.difficultItem}
                            key={question.id}
                          >
                            <QuestionCard
                              question={question}
                              difficult
                              onToggleDifficult={() =>
                                dispatch({
                                  type: 'toggle-difficult',
                                  questionId: question.id,
                                })
                              }
                            />
                            <details className={styles.fullQuestion}>
                              <summary>
                                <span>查看完整題目與選項</span>
                                <IconChevronDown
                                  size={18}
                                  stroke={2}
                                  aria-hidden="true"
                                />
                              </summary>
                              <div>
                                <QuestionPrompt question={question} />
                                <QuestionSourceLine question={question} />
                                <ol
                                  aria-label={`第 ${question.questionNumber} 題完整選項`}
                                >
                                  {question.options.map((option, index) => {
                                    const optionLabel = String.fromCharCode(
                                      65 + index,
                                    );
                                    const accepted =
                                      acceptedAnswers.includes(index);

                                    return (
                                      <li
                                        key={`${question.id}-${index}`}
                                        data-accepted={accepted || undefined}
                                        aria-label={
                                          accepted
                                            ? `正確選項 ${optionLabel}：${option}`
                                            : undefined
                                        }
                                      >
                                        <b>{optionLabel}</b>
                                        <span>{option}</span>
                                      </li>
                                    );
                                  })}
                                </ol>
                                <section
                                  className={styles.explanationPanel}
                                  aria-label={`第 ${question.questionNumber} 題詳解`}
                                >
                                  <span>詳解</span>
                                  <p>
                                    {question.explanation?.trim() ||
                                      '目前尚無詳解。'}
                                  </p>
                                </section>
                              </div>
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={IconBulb}
          title="還沒有標記難題"
          description="在作答頁、交卷結果或詳解頁按下「標記為難題」，題目就會出現在這裡。"
        />
      )}
    </section>
  );
}
