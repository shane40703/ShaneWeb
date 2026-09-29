import { useState } from 'react';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconCircleCheck,
  IconLoader2,
  IconRepeat,
  IconX,
} from '@tabler/icons-react';
import { ReviewNoteEditor } from '@/components/attempt-review';
import { EmptyState, QuestionCard } from '@/components/content/content';
import {
  QuestionSelector,
  type SelectorYear,
} from '@/components/question-selector';
import { Button, OptionGroup } from '@/components/ui/ui';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import {
  formatCorrectAnswer,
  formatDateTime,
  isQuestionCorrect,
  isSubjectId,
} from '@/lib/study';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import { getWrongQuestionStats } from '@/lib/wrong-questions';
import { subjects, years } from '@/question-bank/catalog';
import { useAppState } from '@/state/app-state';
import styles from './wrong-page.module.css';

function WrongQuestionPractice({ question }: { question: Question }) {
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
        <div
          className={styles.practiceResult}
          data-result={correct ? 'correct' : 'wrong'}
          role="status"
        >
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

export function WrongPage({
  attempts,
  questions,
  questionBankStatuses = {},
  onRetryQuestionBank,
}: {
  attempts: QuizAttempt[];
  questions: Question[];
  questionBankStatuses?: Partial<Record<SubjectId, QuestionBankStatus>>;
  onRetryQuestionBank?: (subject: SubjectId) => void;
}) {
  const { state, dispatch, hydrated } = useAppState();
  const [subjectFilter, setSubjectFilter] = useState<SubjectId>();
  const [yearFilter, setYearFilter] = useState<number>();
  const stats = getWrongQuestionStats(attempts, questions);
  const attemptedSubjects = [
    ...new Set(
      attempts.flatMap((attempt) =>
        isSubjectId(attempt.subject) ? [attempt.subject] : [],
      ),
    ),
  ];
  const loadingSubjects = attemptedSubjects.filter(
    (subjectId) => questionBankStatuses[subjectId] === 'loading',
  );
  const failedSubjects = attemptedSubjects.filter(
    (subjectId) => questionBankStatuses[subjectId] === 'error',
  );
  const availableSubjects = subjects.filter((subject) =>
    stats.some(({ question }) => question.subject === subject.id),
  );
  const activeSubjectFilter = availableSubjects.some(
    (subject) => subject.id === subjectFilter,
  )
    ? subjectFilter
    : availableSubjects[0]?.id;
  const activeSubject = availableSubjects.find(
    (subject) => subject.id === activeSubjectFilter,
  );
  const subjectStats = stats.filter(
    ({ question }) => question.subject === activeSubjectFilter,
  );
  const availableYears = years.filter((year) =>
    subjectStats.some(({ question }) => question.year === year),
  );
  const activeYearFilter = yearFilter && availableYears.includes(yearFilter)
    ? yearFilter
    : availableYears[0];
  const visibleStats = subjectStats
    .filter(({ question }) => question.year === activeYearFilter)
    .sort(
      (left, right) =>
        right.wrongCount - left.wrongCount ||
        left.question.questionNumber - right.question.questionNumber,
    );
  const disabledSubjectIds = subjects
    .filter((subject) => !availableSubjects.some((item) => item.id === subject.id))
    .map((subject) => subject.id);

  function changeYear(nextYear: SelectorYear) {
    if (typeof nextYear === 'number') setYearFilter(nextYear);
  }

  if (!hydrated) {
    return (
      <section className={styles.panel}>
        <EmptyState icon={IconLoader2} title="正在讀取常錯題目" description="請稍候。" />
      </section>
    );
  }

  if (!attempts.length) {
    return (
      <section className={styles.panel}>
        <EmptyState
          icon={IconRepeat}
          title="還沒有作答紀錄"
          description="完成並交卷歷屆試題後，答錯的題目與累計次數會整理在這裡。"
        />
      </section>
    );
  }

  if (!stats.length && loadingSubjects.length) {
    return (
      <section className={styles.panel}>
        <EmptyState
          icon={IconLoader2}
          title="正在整理常錯題目"
          description="正在依作答紀錄取得題目與答案，請稍候。"
        />
      </section>
    );
  }

  if (!stats.length && !failedSubjects.length) {
    return (
      <section className={styles.panel}>
        <EmptyState
          icon={IconCircleCheck}
          title="目前沒有答錯題目"
          description="已載入的歷屆試題紀錄中沒有錯題，繼續保持。"
        />
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.loadedContent}>
        {failedSubjects.length ? (
          <section className={styles.bankNotice} role="alert">
            <IconAlertTriangle size={20} stroke={2} aria-hidden="true" />
            <div>
              <strong>
                {failedSubjects
                  .map((subjectId) =>
                    subjects.find((subject) => subject.id === subjectId)?.name,
                  )
                  .filter(Boolean)
                  .join('、')}
                的錯題載入失敗
              </strong>
              <p>其他已載入科目的錯題與次數仍可查看。</p>
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
        {loadingSubjects.length && stats.length ? (
          <section className={styles.bankNotice} role="status">
            <IconLoader2 size={20} stroke={2} aria-hidden="true" />
            <div>
              <strong>尚有錯題正在整理</strong>
              <p>已完成的科目會先顯示在下方。</p>
            </div>
          </section>
        ) : null}
        {stats.length ? (
          <>
            <section className={styles.summary} aria-label="常錯題目摘要">
              <div>
                <span>錯題數</span>
                <strong>{stats.length}</strong>
              </div>
              <div>
                <span>累計答錯</span>
                <strong>{stats.reduce((total, item) => total + item.wrongCount, 0)}</strong>
              </div>
              <p>依已儲存的歷屆試題交卷紀錄統計；重新答對不會刪除過去的錯題次數。</p>
            </section>
            <div className={styles.selector}>
              <QuestionSelector
                subjectId={activeSubjectFilter ?? subjects[0].id}
                year={activeYearFilter ?? years[0]}
                yearOptions={years.map((year) => ({
                  value: year,
                  disabled: !availableYears.includes(year),
                }))}
                disabledSubjectIds={disabledSubjectIds}
                onSubjectChange={setSubjectFilter}
                onYearChange={changeYear}
                ariaLabel="常錯題目科目與年度分類"
              />
            </div>
            <div className={styles.subjectList}>
              {activeSubject && activeYearFilter ? (
                <section
                  className={styles.subjectGroup}
                  aria-labelledby={`wrong-subject-${activeSubject.id}-${activeYearFilter}`}
                >
                  <header className={styles.subjectHeader}>
                    <h2 id={`wrong-subject-${activeSubject.id}-${activeYearFilter}`}>
                      {activeSubject.name} · {activeYearFilter} 年
                    </h2>
                    <span>
                      {visibleStats.length} 題・共答錯{' '}
                      {visibleStats.reduce((total, item) => total + item.wrongCount, 0)} 次
                    </span>
                  </header>
                  <div className={styles.questionList}>
                    {visibleStats.map(({ question, wrongCount, lastWrongAt }) => (
                      <article className={styles.wrongItem} key={question.id}>
                        <div className={styles.wrongMeta}>
                          <strong>累計答錯 {wrongCount} 次</strong>
                          <span>最近答錯：{formatDateTime(lastWrongAt)}</span>
                        </div>
                        <QuestionCard
                          question={question}
                          difficult={state.difficultQuestionIds.includes(question.id)}
                          onToggleDifficult={() =>
                            dispatch({
                              type: 'toggle-difficult',
                              questionId: question.id,
                            })
                          }
                        />
                        <details className={styles.fullQuestion}>
                          <summary>
                            <span>查看選項、重新作答與詳解</span>
                            <IconChevronDown size={18} stroke={2} aria-hidden="true" />
                          </summary>
                          <div>
                            <WrongQuestionPractice question={question} />
                            <section
                              className={styles.explanationPanel}
                              aria-label={`第 ${question.questionNumber} 題詳解`}
                            >
                              <span>詳解</span>
                              <p>{question.explanation?.trim() || '目前尚無詳解。'}</p>
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
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            icon={IconAlertTriangle}
            title="錯題內容暫時無法顯示"
            description="題庫載入失敗，已保存的作答紀錄不受影響。"
          />
        )}
      </div>
    </section>
  );
}
