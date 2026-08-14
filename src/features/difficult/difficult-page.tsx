import { useState } from 'react';
import {
  EmptyState,
  QuestionCard,
  QuestionPrompt,
  QuestionSourceLine,
} from '@/components/content/content';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { ReviewNoteEditor } from '@/components/attempt-review';
import {
  IconBulb,
  IconLoader2,
  IconChevronDown,
  IconPlugConnectedX,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { subjectsOfQuestionIds } from '@/lib/question-path';
import type { Question, SubjectId } from '@/lib/types';
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

export function DifficultPage({
  questions,
  questionBankStatuses = {},
  onRetryQuestionBank,
}: {
  questions: Question[];
  questionBankStatuses?: Partial<Record<SubjectId, QuestionBankStatus>>;
  onRetryQuestionBank?: (subject: SubjectId) => void;
}) {
  const { state, dispatch, hydrated } = useAppState();
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');
  const difficultQuestions = questions.filter((question) =>
    state.difficultQuestionIds.includes(question.id),
  );
  const filteredDifficultQuestions =
    subjectFilter === 'all'
      ? difficultQuestions
      : difficultQuestions.filter(
          (question) => question.subject === subjectFilter,
        );
  const subjectGroups = groupDifficultQuestions(filteredDifficultQuestions);
  const difficultSubjects = subjectsOfQuestionIds(state.difficultQuestionIds);
  const loadingSubjects = difficultSubjects.filter(
    (subjectId) => questionBankStatuses[subjectId] === 'loading',
  );
  const failedSubjects = difficultSubjects.filter(
    (subjectId) => questionBankStatuses[subjectId] === 'error',
  );

  return (
    <section className={styles.panel}>
      {!hydrated ? (
        <EmptyState icon={IconLoader2} title="正在讀取難題" description="請稍候。" />
      ) : !state.difficultQuestionIds.length ? (
        <EmptyState
          icon={IconBulb}
          title="還沒有標記難題"
          description="在作答頁、交卷結果或詳解頁按下「標記為難題」，題目就會出現在這裡。"
        />
      ) : (
        <div className={styles.loadedContent}>
          {failedSubjects.length ? (
            <section className={styles.bankNotice} role="alert">
              <IconPlugConnectedX size={20} stroke={2} aria-hidden="true" />
              <div>
                <strong>
                  {failedSubjects
                    .map((subjectId) => subjects.find(
                      (subject) => subject.id === subjectId,
                    )?.name)
                    .filter(Boolean)
                    .join('、')}
                  的難題載入失敗
                </strong>
                <p>其他已載入的難題仍可查看與取消標記。</p>
              </div>
              {onRetryQuestionBank ? (
                <Button
                  variant="primary"
                  onClick={() =>
                    failedSubjects.forEach((subjectId) =>
                      onRetryQuestionBank(subjectId),
                    )
                  }
                >
                  重新載入
                </Button>
              ) : null}
            </section>
          ) : null}
          {loadingSubjects.length ? (
            <section className={styles.bankNotice} role="status">
              <IconLoader2 size={20} stroke={2} aria-hidden="true" />
              <div>
                <strong>尚有難題正在載入</strong>
                <p>已完成的科目會先顯示在下方。</p>
              </div>
            </section>
          ) : null}
          {difficultQuestions.length ? (
            <section
              className={styles.subjectFilters}
              role="group"
              aria-label="難題科目分類"
            >
              <button
                type="button"
                aria-pressed={subjectFilter === 'all'}
                onClick={() => setSubjectFilter('all')}
              >
                全部 <span>{difficultQuestions.length}</span>
              </button>
              {subjects.map((subject) => {
                const count = difficultQuestions.filter(
                  (question) => question.subject === subject.id,
                ).length;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={subjectFilter === subject.id}
                    disabled={!count}
                    onClick={() => setSubjectFilter(subject.id)}
                  >
                    {subject.name} <span>{count}</span>
                  </button>
                );
              })}
            </section>
          ) : null}
          {subjectGroups.length ? (
            <div className={styles.subjectList}>
              {subjectGroups.map(
                ({ subject, questions: groupedQuestions, yearGroups }) => (
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
                            {yearQuestions.map((question) => (
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
                                    <QuestionSourceLine question={question} />
                                    <QuestionPrompt question={question} />
                                    <QuestionAnswerPanel
                                      question={question}
                                      heading={null}
                                      ariaLabel={`第 ${question.questionNumber} 題完整選項`}
                                    />
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
                                    <div className={styles.noteEditor}>
                                      <ReviewNoteEditor question={question} />
                                    </div>
                                  </div>
                                </details>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                ),
              )}
            </div>
          ) : difficultQuestions.length ? (
            <EmptyState
              icon={IconBulb}
              title="這個科目沒有難題"
              description="可切換到其他科目查看已標記的題目。"
            />
          ) : !failedSubjects.length && !loadingSubjects.length ? (
            <EmptyState
              icon={IconPlugConnectedX}
              title="難題內容暫時無法顯示"
              description="題目可能已移除，其他已保存資料不受影響。"
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
