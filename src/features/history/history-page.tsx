import Link from 'next/link';
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
import { parseQuestionId, questionPathFromId } from '@/lib/question-path';
import {
  calculateScore,
  formatDateTime,
  getAttemptScopeKey,
  getSubjectScoreConfig,
  isQuestionCorrect,
} from '@/lib/study';
import type { Question, QuizAttempt, SubjectId } from '@/lib/types';
import { useAppState } from '@/state/app-state';
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

function retryHref(attempt: QuizAttempt) {
  const baseHref = questionPathFromId(attempt.questionIds[0] ?? '') ?? '/papers';
  return attempt.mode === 'random' && attempt.questionIds.length
    ? `${baseHref}?mode=random&questions=${encodeURIComponent(
        attempt.questionIds.join(','),
      )}`
    : baseHref;
}

export function HistoryPage({
  questions,
  questionBankStatuses = {},
  onRetryQuestionBank,
}: {
  questions: Question[];
  questionBankStatuses?: Partial<Record<SubjectId, QuestionBankStatus>>;
  onRetryQuestionBank?: (subject: SubjectId) => void;
}) {
  const { state, dispatch, hydrated } = useAppState();
  const { notify } = useToast();
  const [subjectFilter, setSubjectFilter] = useState<'mixed' | SubjectId>();
  const [historyView, setHistoryView] = useState<ResultView>('review');
  const [attemptViews, setAttemptViews] = useState<
    Record<string, ResultView | undefined>
  >({});
  const availableSubjectFilters = [
    ...subjects
      .map((subject) => subject.id)
      .filter((subjectId) =>
        state.attempts.some((attempt) => attempt.subject === subjectId),
      ),
    ...(state.attempts.some((attempt) => attempt.subject === 'mixed')
      ? (['mixed'] as const)
      : []),
  ];
  const activeSubjectFilter =
    subjectFilter && availableSubjectFilters.includes(subjectFilter)
      ? subjectFilter
      : availableSubjectFilters[0];
  const filteredAttempts = state.attempts.filter(
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
  const repeatPaperYear = availablePaperYears.length
    ? availablePaperYears[filteredAttempts.length % availablePaperYears.length]
    : undefined;
  const continuationYear = nextPaperYear ?? repeatPaperYear;
  const mixedCount = state.attempts.filter(
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

  function deleteAttempt(attemptId: string) {
    dispatch({ type: 'delete-attempt', attemptId });
    notify('已清除這次作答紀錄');
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
      {hydrated && state.attempts.length ? (
        <section
          className={styles.subjectFilters}
          role="group"
          aria-label="已作答紀錄科目分類"
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
                    state.attempts.filter((attempt) => attempt.subject === subject.id)
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
            ariaLabel="已作答紀錄分頁"
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
              description="完成其他年度試卷後，這裡會彙整每次答錯的分類與題目。"
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
                  aria-label={`${yearGroup.year ? `${yearGroup.year} 年` : '跨年度'}作答紀錄`}
                >
                  <summary>
                    <strong>
                      {yearGroup.year ? `${yearGroup.year} 年` : '跨年度'}
                    </strong>
                    <span>共作答 {yearGroup.entries.length} 次</span>
                    <IconChevronDown size={20} stroke={2} aria-hidden="true" />
                  </summary>
                  <div className={styles.yearGroupContent}>
              {yearGroup.scopeGroups.map(({ key, entries, ordinalById }) => {
              const first = entries[0];
              const subject =
                first.subject === 'mixed' ? null : getSubject(first.subject);
              return (
                <article className={styles.attemptGroup} key={key}>
                  <header className={styles.groupHeader}>
                    <div>
                      <div className={styles.tags}>
                        <Tag tone={first.mode === 'paper' ? 'blue' : 'purple'}>
                          {first.mode === 'paper' ? '歷屆試題' : '隨機題組'}
                        </Tag>
                        {subject ? (
                          <Tag tone="green">{subject.name}</Tag>
                        ) : (
                          <Tag tone="green">跨科目</Tag>
                        )}
                        {first.year ? <Tag>{first.year} 年</Tag> : null}
                      </div>
                      <h2>
                        {subject?.name ?? '跨科目練習'}
                        {first.year ? `・${first.year} 年` : ''}
                      </h2>
                    </div>
                    <div className={styles.groupActions}>
                      <strong>共作答 {entries.length} 次</strong>
                      <Button variant="primary" render={<Link href={retryHref(first)} />}>
                        再做一次
                      </Button>
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
                            </div>
                            <div className={styles.score}>
                              {attempt.mode === 'random' ? (
                                <>
                                  <strong>
                                    {attempt.correctCount} /{' '}
                                    {attempt.questionIds.length} 題
                                  </strong>
                                  <span>答對題數</span>
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
                                {activeAttemptView === 'wrong-analysis' &&
                                hasVisibleWrongQuestions ? (
                                  <WrongCategoryAnalysis
                                    attempt={attempt}
                                    questions={attemptQuestions}
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
                                  清除第 {ordinal} 次紀錄
                                </Button>
                              }
                              title={`清除第 ${ordinal} 次作答紀錄？`}
                              description="只會刪除這一次的作答結果，其他紀錄與筆記不受影響。"
                              confirmLabel="確認清除"
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
              {activeSubjectFilter &&
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
                        href={`/papers?subject=${activeSubjectFilter}&year=${continuationYear}`}
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
              title="還沒有作答紀錄"
              description="完成並交卷後，結果會保存在這裡。"
              action={
                <Button variant="primary" render={<Link href="/papers" />}>
                  開始第一份試卷
                </Button>
              }
            />
          )}
        </section>
      )}
    </>
  );
}
