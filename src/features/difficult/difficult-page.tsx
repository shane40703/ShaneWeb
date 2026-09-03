import { useState } from 'react';
import {
  EmptyState,
  QuestionCard,
} from '@/components/content/content';
import { ReviewNoteEditor } from '@/components/attempt-review';
import {
  IconBulb,
  IconCircleCheck,
  IconLoader2,
  IconChevronDown,
  IconPlugConnectedX,
  IconX,
} from '@tabler/icons-react';
import { Button, OptionGroup } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { subjectsOfQuestionIds } from '@/lib/question-path';
import { formatCorrectAnswer, isQuestionCorrect } from '@/lib/study';
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

function DifficultQuestionPractice({ question }: { question: Question }) {
  const { dispatch } = useAppState();
  const [selected, setSelected] = useState<number>();
  const [checked, setChecked] = useState(false);
  const correct = checked && isQuestionCorrect(question, selected);

  function checkAnswer() {
    if (selected === undefined) return;
    dispatch({
      type: 'save-answer',
      questionId: question.id,
      selected,
      correct: isQuestionCorrect(question, selected),
      answeredAt: new Date().toISOString(),
    });
    setChecked(true);
  }

  return (
    <section
      className={styles.practicePanel}
      aria-label={`第 ${question.questionNumber} 題重新作答`}
    >
      <OptionGroup
        label={`第 ${question.questionNumber} 題請選擇答案`}
        options={question.options}
        value={selected}
        disabled={checked}
        onValueChange={(value) => {
          setSelected(value);
          setChecked(false);
        }}
      />
      {checked ? (
        <div className={styles.practiceResult} data-result={correct ? 'correct' : 'wrong'} role="status">
          {correct ? (
            <IconCircleCheck size={20} stroke={2.3} aria-hidden="true" />
          ) : (
            <IconX size={20} stroke={2.3} aria-hidden="true" />
          )}
          <strong>{correct ? '答對了，已掌握這題' : '答錯了，再複習一次'}</strong>
          <span>標準答案：{formatCorrectAnswer(question)}</span>
        </div>
      ) : null}
      <div className={styles.practiceActions}>
        {checked ? (
          <Button
            onClick={() => {
              setSelected(undefined);
              setChecked(false);
            }}
          >
            重新作答
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={selected === undefined}
            onClick={checkAnswer}
          >
            檢查答案
          </Button>
        )}
      </div>
    </section>
  );
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
  const [subjectFilter, setSubjectFilter] = useState<SubjectId>();
  const difficultQuestions = questions.filter((question) =>
    state.difficultQuestionIds.includes(question.id),
  );
  const availableSubjects = subjects.filter((subject) =>
    difficultQuestions.some((question) => question.subject === subject.id),
  );
  const activeSubjectFilter = availableSubjects.some(
    (subject) => subject.id === subjectFilter,
  )
    ? subjectFilter
    : availableSubjects[0]?.id;
  const filteredDifficultQuestions = difficultQuestions.filter(
    (question) => question.subject === activeSubjectFilter,
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
              {availableSubjects.map((subject) => {
                const count = difficultQuestions.filter(
                  (question) => question.subject === subject.id,
                ).length;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={activeSubjectFilter === subject.id}
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
                                    <span>查看選項、作答與詳解</span>
                                    <IconChevronDown
                                      size={18}
                                      stroke={2}
                                      aria-hidden="true"
                                    />
                                  </summary>
                                  <div>
                                    <DifficultQuestionPractice question={question} />
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
