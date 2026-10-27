import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  IconArrowRight,
  IconChevronUp,
  IconChevronDown,
  IconHistory,
  IconLoader2,
  IconTrash,
} from '@tabler/icons-react';
import { AttemptReview } from '@/components/attempt-review';
import { EmptyState, Tag } from '@/components/content/content';
import {
  ResultViewTabs,
  type ResultView,
} from '@/components/result-view-tabs';
import { Button, ConfirmDialog, useToast } from '@/components/ui/ui';
import { WrongCategoryAnalysis } from '@/components/wrong-category-analysis';
import { getSubject, subjects, years as paperYears } from '@/question-bank/catalog';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { parseQuestionId } from '@/lib/question-path';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import {
  calculateScore,
  formatDateTime,
  formatDuration,
  getAttemptScopeKey,
  getSubjectScoreConfig,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import {
  isMockExamStarted,
  mockExamHref,
  mockExamQuestionId,
  mockExamScope,
  startMockExamDraft,
} from '@/features/practice/mock-exam';
import {
  readMockExamDraft,
  saveMockExamDraft,
} from '@/features/practice/mock-exam-store';
import { practiceMockExamPage, practiceQuizPage } from '@/features/practice/practice-pages';
import {
  createPracticeSessionFromQuestions,
  DEFAULT_PRACTICE_SETTINGS,
  hasPracticeProgress,
  parsePracticeSession,
  PRACTICE_SESSION_STORAGE_KEY,
  practiceQuestionHref,
} from '@/features/practice/practice-session';
import { useAppState } from '@/state/app-state';
import { selectHistoryAttempts } from './history-attempts';
import styles from './history-page.module.css';

function groupAttempts(attempts: QuizAttempt[]) {
  const groups = new Map<string, QuizAttempt[]>();
  attempts.forEach((attempt) => {
    const key = getAttemptScopeKey(attempt);
    groups.set(key, [...(groups.get(key) ?? []), attempt]);
  });
  return [...groups.entries()].map(([key, entries]) => {
    const ordinalById = new Map(
      [...entries]
        .sort(
          (left, right) =>
            new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime(),
        )
        .map((attempt, index) => [attempt.id, index + 1]),
    );
    return { key, entries, ordinalById };
  });
}

function groupAttemptsByYear(attempts: QuizAttempt[]) {
  const years = new Map<number | null, QuizAttempt[]>();
  attempts.forEach((attempt) => {
    years.set(attempt.year, [...(years.get(attempt.year) ?? []), attempt]);
  });
  return [...years.entries()]
    .sort(([left], [right]) => (right ?? -1) - (left ?? -1))
    .map(([year, entries]) => ({
      key: year === null ? 'cross-year' : String(year),
      year,
      entries,
      scopeGroups: groupAttempts(entries),
    }));
}

/** The years a 每日抽題練習 set drew from, e.g. 「104–114 年」. */
function practiceYearRange(attempt: QuizAttempt) {
  const attemptYears = attempt.questionIds.flatMap((questionId) => {
    const parsed = parseQuestionId(questionId);
    return parsed ? [parsed.year] : [];
  });
  if (!attemptYears.length) return null;
  const from = Math.min(...attemptYears);
  const to = Math.max(...attemptYears);
  return from === to ? `${from} 年` : `${from}–${to} 年`;
}

/** 每日抽題練習 scores like its result page: answered questions only. */
function practiceAccuracy(attempt: QuizAttempt) {
  const answered = attempt.correctCount + attempt.wrongCount;
  return {
    answered,
    accuracy: answered ? Math.round((attempt.correctCount / answered) * 100) : null,
  };
}

export function HistoryPage({
  questions,
  questionBankStatuses = {},
  onRetryQuestionBank,
  dailyOnly = false,
}: {
  questions: Question[];
  questionBankStatuses?: Partial<Record<SubjectId, QuestionBankStatus>>;
  onRetryQuestionBank?: (subject: SubjectId) => void;
  dailyOnly?: boolean;
}) {
  const router = useRouter();
  const { state, dispatch, hydrated, reportPersistence } = useAppState();
  const { notify } = useToast();
  const attempts = selectHistoryAttempts(state.attempts, dailyOnly);
  const historyLabel = dailyOnly ? '每日練習履歷' : '歷屆試題作答履歷';
  const [subjectFilter, setSubjectFilter] = useState<'mixed' | SubjectId>();
  const [historyView, setHistoryView] = useState<ResultView>('review');
  const [attemptViews, setAttemptViews] = useState<
    Record<string, ResultView | undefined>
  >({});
  const availableSubjectFilters = [
    ...subjects
      .map((subject) => subject.id)
      .filter((subjectId) =>
        attempts.some((attempt) => attempt.subject === subjectId),
      ),
    ...(attempts.some((attempt) => attempt.subject === 'mixed')
      ? (['mixed'] as const)
      : []),
  ];
  const activeSubjectFilter =
    subjectFilter && availableSubjectFilters.includes(subjectFilter)
      ? subjectFilter
      : availableSubjectFilters[0];
  const filteredAttempts = attempts.filter(
    (attempt) => attempt.subject === activeSubjectFilter,
  );
  const yearGroups = groupAttemptsByYear(filteredAttempts);
  const availablePaperYears =
    activeSubjectFilter && activeSubjectFilter !== 'mixed'
      ? paperYears
      : [];
  const completedPaperYears = new Set(
    filteredAttempts.flatMap((attempt) =>
      attempt.mode === 'paper' && attempt.year !== null ? [attempt.year] : [],
    ),
  );
  const nextPaperYear = availablePaperYears.find(
    (year) => !completedPaperYears.has(year),
  );
  const paperAttemptCount = filteredAttempts.filter(
    (attempt) => attempt.mode === 'paper',
  ).length;
  const repeatPaperYear = availablePaperYears.length
    ? availablePaperYears[paperAttemptCount % availablePaperYears.length]
    : undefined;
  const continuationYear = nextPaperYear ?? repeatPaperYear;
  const mixedCount = attempts.filter(
    (attempt) => attempt.subject === 'mixed',
  ).length;
  const filteredWrongCount = filteredAttempts.reduce(
    (total, attempt) => total + attempt.wrongCount,
    0,
  );
  const filteredQuestionIds = new Set(
    filteredAttempts.flatMap((attempt) => attempt.questionIds),
  );
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const loadedWrongCount = filteredAttempts.reduce(
    (total, attempt) =>
      total +
      attempt.questionIds.filter((questionId) => {
        const question = questionById.get(questionId);
        const selectedAnswer = attempt.answers[questionId];
        return (
          question &&
          selectedAnswer !== undefined &&
          !isQuestionCorrect(question, selectedAnswer)
        );
      }).length,
    0,
  );
  const unresolvedWrongCount = Math.max(
    0,
    filteredWrongCount - loadedWrongCount,
  );
  const filteredQuestionStatuses = [
    ...new Set(
      [...filteredQuestionIds].flatMap((questionId) => {
        const parsed = parseQuestionId(questionId);
        return parsed ? [questionBankStatuses[parsed.subject]] : [];
      }),
    ),
  ];

  /** Open a fresh whole paper directly, without returning to the paper picker. */
  function retryMockExam(attempt: QuizAttempt) {
    if (attempt.subject === 'mixed' || attempt.year === null) {
      void router.push(practiceMockExamPage.href);
      return;
    }
    const scope = mockExamScope(attempt.subject, attempt.year);
    if (
      isMockExamStarted(readMockExamDraft(scope)) &&
      !window.confirm('這份試卷還有未完成的作答，要清除進度並重新開始嗎？已完成的作答紀錄會保留。')
    ) {
      return;
    }
    reportPersistence(
      'quiz-progress',
      saveMockExamDraft(
        scope,
        startMockExamDraft(mockExamQuestionId(attempt.subject, attempt.year, 1)),
      ),
    );
    void router.push(
      mockExamHref({ subject: attempt.subject, year: attempt.year, q: 1 }),
    );
  }

  /** 再做一次 for 每日抽題練習: the same questions in the same order, options reshuffled. */
  function retryPractice(attempt: QuizAttempt) {
    if (attempt.subject === 'mixed') return;
    const setQuestions = attempt.questionIds.flatMap((questionId) => {
      const question = questionById.get(questionId);
      return question ? [question] : [];
    });
    if (setQuestions.length !== attempt.questionIds.length) return;
    const current = parsePracticeSession(readStoredValue(PRACTICE_SESSION_STORAGE_KEY));
    if (
      current &&
      hasPracticeProgress(current) &&
      !window.confirm('目前的每日抽題練習還沒完成，要放棄並改練這組題目嗎？作答進度會清除。')
    ) {
      return;
    }
    const session = createPracticeSessionFromQuestions(
      setQuestions,
      attempt.subject,
      DEFAULT_PRACTICE_SETTINGS.shuffleOptions,
    );
    const saved = writeStoredValue(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify(session));
    reportPersistence('practice-session', saved);
    // The practice page reads the set back from storage, so without it there is nothing to open.
    if (saved !== 'saved') {
      notify('瀏覽器無法儲存練習進度，暫時無法開始這組題目。', undefined, 'error');
      return;
    }
    void router.push(practiceQuestionHref(0));
  }

  function deleteAttempt(attemptId: string) {
    dispatch({ type: 'delete-attempt', attemptId });
    notify(dailyOnly ? '已刪除這次每日練習履歷' : '已清除這次作答紀錄');
  }

  function selectAttemptView(attemptId: string, view: ResultView) {
    setAttemptViews((current) => ({ ...current, [attemptId]: view }));
  }

  function toggleAttemptView(attemptId: string, view: ResultView) {
    setAttemptViews((current) => {
      const next = { ...current };
      if (current[attemptId] === view) delete next[attemptId];
      else next[attemptId] = view;
      return next;
    });
  }

  return (
    <>
      {dailyOnly ? <p className={styles.historyNotice}>
        只收錄你選擇儲存的每日抽題練習，可查看題目、作答答案、正確率及時間。
        歷屆試題模擬考的紀錄請至 <Link href="/history">歷屆試題作答履歷</Link> 查看。
      </p> : null}
      {hydrated && attempts.length ? (
        <section
          className={styles.subjectFilters}
          role="group"
          aria-label={`${historyLabel}科目分類`}
        >
          <div>
            {subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                aria-pressed={activeSubjectFilter === subject.id}
                onClick={() => setSubjectFilter(subject.id)}
              >
                {subject.name}
                <span>
                  {
                    attempts.filter((attempt) => attempt.subject === subject.id)
                      .length
                  }
                </span>
              </button>
            ))}
            {mixedCount ? (
              <button
                type="button"
                aria-pressed={activeSubjectFilter === 'mixed'}
                onClick={() => setSubjectFilter('mixed')}
              >
                跨科目 <span>{mixedCount}</span>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      {hydrated && filteredAttempts.length ? (
        <div className={styles.historyViewTabs}>
          <ResultViewTabs
            value={historyView}
            onValueChange={setHistoryView}
            idPrefix="history"
            ariaLabel={`${historyLabel}分頁`}
            reviewLabel="每次作答紀錄"
            analysisLabel="跨年度錯題分析"
          />
        </div>
      ) : null}
      {hydrated &&
      filteredAttempts.length &&
      historyView === 'wrong-analysis' ? (
        <section
          className={styles.crossYearPanel}
          id="history-wrong-analysis-panel"
          role="tabpanel"
          aria-labelledby="history-wrong-analysis-tab"
        >
          {loadedWrongCount ? (
            <>
              <WrongCategoryAnalysis
                attempts={filteredAttempts}
                questions={questions}
                title="跨年度錯題分析"
                eyebrow="CROSS-YEAR WRONG ANSWER ANALYSIS"
                ariaLabel="跨年度錯題分析"
              />
              {unresolvedWrongCount ? (
                <p className={styles.analysisNotice} role="status">
                  {filteredQuestionStatuses.includes('loading')
                    ? `尚有 ${unresolvedWrongCount} 次答錯內容載入中，以下先顯示已載入的分析。`
                    : filteredQuestionStatuses.includes('error')
                      ? `尚有 ${unresolvedWrongCount} 次答錯內容暫時無法顯示，以下先顯示可用的分析。`
                      : `尚有 ${unresolvedWrongCount} 次答錯內容未能依目前題庫完整還原。`}
                </p>
              ) : null}
            </>
          ) : filteredWrongCount &&
            filteredQuestionStatuses.includes('loading') ? (
            <EmptyState
              icon={IconLoader2}
              title="正在載入跨年度錯題"
              description="題目載入完成後，就能依分類查看歷次答錯紀錄。"
            />
          ) : filteredWrongCount ? (
            <EmptyState
              icon={IconHistory}
              title="錯題內容暫時無法顯示"
              description="作答次數與分數仍會保留，請確認連線後再試一次。"
            />
          ) : (
            <EmptyState
              icon={IconHistory}
              title="目前沒有跨年度錯題"
              description={dailyOnly
                ? '儲存每日抽題練習後，這裡會彙整每次答錯的分類與題目。'
                : '完成歷屆試題模擬考後，這裡會彙整每次答錯的分類與題目。'}
            />
          )}
        </section>
      ) : (
        <section
          className={styles.panel}
          id="history-review-panel"
          role={hydrated && filteredAttempts.length ? 'tabpanel' : undefined}
          aria-labelledby={
            hydrated && filteredAttempts.length
              ? 'history-review-tab'
              : undefined
          }
        >
          {!hydrated ? (
            <EmptyState
              icon={IconLoader2}
              title="正在讀取紀錄"
              description="請稍候。"
            />
          ) : yearGroups.length ? (
            <div className={styles.list}>
              {yearGroups.map((yearGroup) => (
                <details
                  className={styles.yearGroup}
                  key={yearGroup.key}
                  aria-label={`${yearGroup.year ? `${yearGroup.year} 年` : dailyOnly ? '每日抽題練習' : '跨年度試題'}作答紀錄`}
                >
                  <summary>
                    <strong>
                      {yearGroup.year ? `${yearGroup.year} 年` : dailyOnly ? '每日抽題練習' : '跨年度試題'}
                    </strong>
                    <span>共作答 {yearGroup.entries.length} 次</span>
                    <IconChevronDown size={20} stroke={2} aria-hidden="true" />
                  </summary>
                  <div className={styles.yearGroupContent}>
              {yearGroup.scopeGroups.map(({ key, entries, ordinalById }) => {
              const first = entries[0];
              const subject =
                first.subject === 'mixed' ? null : getSubject(first.subject);
              const isPractice = first.mode === 'practice';
              const practiceReady = first.questionIds.every((questionId) =>
                questionById.has(questionId),
              );
              return (
                <article className={styles.attemptGroup} key={key}>
                  <header className={styles.groupHeader}>
                    <div>
                      <div className={styles.tags}>
                        <Tag tone={isPractice ? 'purple' : 'blue'}>
                          {isPractice ? '每日抽題練習' : '歷屆試題模擬考'}
                        </Tag>
                        {subject ? (
                          <Tag tone="green">{subject.name}</Tag>
                        ) : (
                          <Tag tone="green">跨科目</Tag>
                        )}
                        {first.year ? <Tag>{first.year} 年</Tag> : null}
                        {isPractice && practiceYearRange(first) ? (
                          <Tag>{practiceYearRange(first)}</Tag>
                        ) : null}
                      </div>
                      <h2>
                        {subject?.name ?? '跨科目練習'}
                        {first.year ? `・${first.year} 年` : ''}
                        {isPractice ? `・每日抽題練習 ${first.questionIds.length} 題` : ''}
                      </h2>
                    </div>
                    <div className={styles.groupActions}>
                      <strong>共作答 {entries.length} 次</strong>
                      {isPractice && !practiceReady ? (
                        <small className={styles.retryHint} id={`retry-hint-${first.id}`}>
                          題目載入完成後才能再做一次
                        </small>
                      ) : null}
                      {isPractice ? (
                        <Button
                          variant="primary"
                          disabled={!practiceReady}
                          aria-describedby={
                            practiceReady ? undefined : `retry-hint-${first.id}`
                          }
                          onClick={() => retryPractice(first)}
                        >
                          再做一次
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => retryMockExam(first)}
                        >
                          再做一次
                        </Button>
                      )}
                    </div>
                  </header>

                  <div className={styles.attemptList}>
                    {entries.map((attempt) => {
                      const attemptQuestions = attempt.questionIds.flatMap((id) => {
                        const question = questions.find(
                          (candidate) => candidate.id === id,
                        );
                        return question ? [question] : [];
                      });
                      const loadedQuestionIds = new Set(
                        attemptQuestions.map((item) => item.id),
                      );
                      const missingQuestionIds = attempt.questionIds.filter(
                        (id) => !loadedQuestionIds.has(id),
                      );
                      const missingQuestionCount = missingQuestionIds.length;
                      const missingSubjects = [
                        ...new Set(
                          missingQuestionIds.flatMap((id) => {
                            const parsed = parseQuestionId(id);
                            return parsed ? [parsed.subject] : [];
                          }),
                        ),
                      ];
                      const loadingQuestionCount = missingQuestionIds.filter(
                        (id) => {
                          const parsed = parseQuestionId(id);
                          return (
                            parsed &&
                            questionBankStatuses[parsed.subject] === 'loading'
                          );
                        },
                      ).length;
                      const failedQuestionCount = missingQuestionIds.filter(
                        (id) => {
                          const parsed = parseQuestionId(id);
                          return (
                            parsed &&
                            questionBankStatuses[parsed.subject] === 'error'
                          );
                        },
                      ).length;
                      const failedSubjects = missingSubjects.filter(
                        (subjectId) =>
                          questionBankStatuses[subjectId] === 'error',
                      );
                      const ordinal = ordinalById.get(attempt.id) ?? 1;
                      const scoreDetails =
                        attempt.mode === 'paper' && attempt.subject !== 'mixed'
                          ? {
                              score: calculateScore(
                                attempt.correctCount,
                                attempt.subject,
                              ),
                              maximumScore: getSubjectScoreConfig(attempt.subject)
                                .maximumScore,
                            }
                          : null;
                      const hasVisibleWrongQuestions = attemptQuestions.some(
                        (item) => {
                          const selectedAnswer = attempt.answers[item.id];
                          return (
                            selectedAnswer !== undefined &&
                            !isQuestionCorrect(item, selectedAnswer)
                          );
                        },
                      );
                      const activeAttemptView = attemptViews[attempt.id];
                      const attemptViewId = `history-attempt-${attempt.id}`;

                      return (
                        <section className={styles.attempt} key={attempt.id}>
                          <header>
                            <div>
                              <h3>第 {ordinal} 次</h3>
                              <time dateTime={attempt.submittedAt}>
                                {formatDateTime(attempt.submittedAt)}
                              </time>
                              {dailyOnly ? <p className={styles.attemptMeta}>
                                共 {attempt.questionIds.length} 題・作答 {practiceAccuracy(attempt).answered} 題・未作答 {attempt.unansweredCount} 題・作答時間 {formatDuration(attempt.elapsedSeconds)}
                              </p> : null}
                            </div>
                            <div className={styles.score}>
                              {attempt.mode === 'practice' ? (
                                <>
                                  <strong>
                                    {practiceAccuracy(attempt).accuracy === null
                                      ? '—'
                                      : `正確率 ${practiceAccuracy(attempt).accuracy}%`}
                                  </strong>
                                  <span>
                                    答對 {attempt.correctCount}／
                                    {practiceAccuracy(attempt).answered} 題
                                  </span>
                                </>
                              ) : (
                                <>
                                  <strong>
                                    {scoreDetails
                                      ? `${scoreDetails.score.toFixed(2)} 分`
                                      : '—'}
                                  </strong>
                                  <span>
                                    {scoreDetails
                                      ? `/ ${scoreDetails.maximumScore.toFixed(2)} 分`
                                      : '無法計算分數'}
                                  </span>
                                </>
                              )}
                            </div>
                          </header>
                          <div className={styles.attemptResultActions}>
                            {attemptQuestions.length ? (
                              <button
                                type="button"
                                className={styles.attemptReviewTrigger}
                                aria-expanded={activeAttemptView === 'review'}
                                aria-controls={`${attemptViewId}-panel`}
                                onClick={() =>
                                  toggleAttemptView(attempt.id, 'review')
                                }
                              >
                                查看完整作答紀錄（{attemptQuestions.length}）
                              </button>
                            ) : null}
                            {hasVisibleWrongQuestions ? (
                              <button
                                type="button"
                                className={styles.wrongAnalysisTrigger}
                                aria-expanded={
                                  activeAttemptView === 'wrong-analysis'
                                }
                                aria-controls={`${attemptViewId}-panel`}
                                onClick={() =>
                                  toggleAttemptView(
                                    attempt.id,
                                    'wrong-analysis',
                                  )
                                }
                              >
                                錯題統計結果
                              </button>
                            ) : null}
                          </div>
                          {attemptQuestions.length && activeAttemptView ? (
                            <div
                              className={styles.attemptResultPanel}
                              id={`${attemptViewId}-panel`}
                            >
                              {hasVisibleWrongQuestions ? (
                                <ResultViewTabs
                                  value={activeAttemptView}
                                  onValueChange={(view) =>
                                    selectAttemptView(attempt.id, view)
                                  }
                                  idPrefix={attemptViewId}
                                  ariaLabel={`第 ${ordinal} 次作答結果分頁`}
                                  reviewLabel="完整作答紀錄"
                                />
                              ) : null}
                              <button
                                type="button"
                                className={styles.collapseResult}
                                onClick={() => toggleAttemptView(attempt.id, activeAttemptView)}
                              >
                                <IconChevronUp size={16} stroke={2} aria-hidden="true" />
                                收起作答結果
                              </button>
                              <div
                                className={styles.attemptResultContent}
                                id={`${attemptViewId}-${activeAttemptView}-panel`}
                                role={
                                  hasVisibleWrongQuestions
                                    ? 'tabpanel'
                                    : undefined
                                }
                                aria-labelledby={
                                  hasVisibleWrongQuestions
                                    ? `${attemptViewId}-${activeAttemptView}-tab`
                                    : undefined
                                }
                              >
                                {attempt.mode === 'practice' ? (
                                  <p className={styles.practiceNote}>
                                    選項依原試卷順序顯示，可能和作答時的順序不同。
                                  </p>
                                ) : null}
                                {activeAttemptView === 'wrong-analysis' &&
                                hasVisibleWrongQuestions ? (
                                  <WrongCategoryAnalysis
                                    attempt={attempt}
                                    questions={attemptQuestions}
                                    embedded
                                  />
                                ) : (
                                  <AttemptReview
                                    attempt={attempt}
                                    questions={attemptQuestions}
                                    embedded
                                    showDifficultActions
                                  />
                                )}
                              </div>
                            </div>
                          ) : null}
                          {missingQuestionCount ? (
                            <div className={styles.attemptReview} role="status">
                              <strong>
                                {loadingQuestionCount === missingQuestionCount
                                  ? `尚有 ${missingQuestionCount} 題內容載入中`
                                  : failedQuestionCount === missingQuestionCount
                                    ? `尚有 ${missingQuestionCount} 題內容暫時無法顯示`
                                    : `尚有 ${missingQuestionCount} 題內容未能完整顯示`}
                              </strong>
                              <p>
                                {failedQuestionCount
                                  ? '這次紀錄的答題統計與操作仍可使用；請確認連線後重新載入題目。'
                                  : '這次紀錄的答題統計與操作仍可使用。'}
                              </p>
                              {failedSubjects.length &&
                              onRetryQuestionBank ? (
                                <Button
                                  variant="primary"
                                  onClick={() =>
                                    failedSubjects.forEach((subjectId) =>
                                      onRetryQuestionBank(subjectId),
                                    )
                                  }
                                >
                                  重新載入題目
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          <footer className={styles.actions}>
                            <ConfirmDialog
                              trigger={
                                <Button variant="danger">
                                  <IconTrash size={16} stroke={2} aria-hidden="true" />
                                  {dailyOnly ? '刪除' : '清除'}第 {ordinal} 次紀錄
                                </Button>
                              }
                              title={`${dailyOnly ? '刪除' : '清除'}第 ${ordinal} 次作答紀錄？`}
                              description="只會刪除這一次的作答結果，其他紀錄與筆記不受影響。"
                              confirmLabel={dailyOnly ? '確認刪除' : '確認清除'}
                              onConfirm={() => deleteAttempt(attempt.id)}
                            />
                          </footer>
                        </section>
                      );
                    })}
                  </div>
                </article>
              );
              })}
                  </div>
                </details>
              ))}
              {!dailyOnly && activeSubjectFilter &&
              activeSubjectFilter !== 'mixed' &&
              continuationYear ? (
                <section className={styles.continueCard}>
                  <div>
                    <span>NEXT PAPER</span>
                    <h2>
                      {nextPaperYear
                        ? `繼續作答 ${continuationYear} 年`
                        : '已完成所有年度'}
                    </h2>
                    <p>
                      {nextPaperYear
                        ? `接著完成${getSubject(activeSubjectFilter)?.name ?? '目前科目'} ${continuationYear} 年試題。`
                        : '所有收錄年度都已作答，可隨機再練習一個年度。'}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    render={
                      <Link
                        href={mockExamHref({
                          subject: activeSubjectFilter,
                          year: continuationYear,
                        })}
                      />
                    }
                  >
                    {nextPaperYear
                      ? `繼續作答 ${continuationYear} 年`
                      : '隨機再做一年題目'}
                    <IconArrowRight size={17} stroke={2} aria-hidden="true" />
                  </Button>
                </section>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={IconHistory}
              title={dailyOnly ? '還沒有每日練習履歷' : '還沒有作答紀錄'}
              description={dailyOnly ? '完成每日抽題練習後，選擇「儲存此次作答」才會加入履歷。不記錄不會新增資料。'
                : '完成歷屆試題模擬考並交卷後，結果會保存在這裡。每日抽題練習請至「每日練習履歷」查看。'}
              action={
                <>
                  {dailyOnly ? <Button role="link" render={<Link href={practiceQuizPage.href} />}>
                    每日抽題練習
                  </Button> : null}
                  {!dailyOnly ? <Button
                    role="link"
                    variant="primary"
                    render={<Link href={practiceMockExamPage.href} />}
                  >
                    開始第一份試卷
                  </Button> : null}
                </>
              }
            />
          )}
        </section>
      )}
    </>
  );
}
