import Link from 'next/link';
import { useState } from 'react';
import {
  IconHistory,
  IconLoader2,
  IconTrash,
} from '@tabler/icons-react';
import { AttemptReview } from '@/components/attempt-review';
import { EmptyState, Tag } from '@/components/content/content';
import { Button, ConfirmDialog, useToast } from '@/components/ui/ui';
import { getSubject, subjects } from '@/question-bank/catalog';
import type { QuestionBankStatus } from '@/lib/question-bank-client';
import { parseQuestionId, questionPathFromId } from '@/lib/question-path';
import {
  calculateScore,
  formatDateTime,
  formatDuration,
  getAttemptScopeKey,
  getSubjectScoreConfig,
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
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'mixed' | SubjectId>('all');
  const filteredAttempts =
    subjectFilter === 'all'
      ? state.attempts
      : state.attempts.filter((attempt) => attempt.subject === subjectFilter);
  const groups = groupAttempts(filteredAttempts);
  const mixedCount = state.attempts.filter(
    (attempt) => attempt.subject === 'mixed',
  ).length;

  function deleteAttempt(attemptId: string) {
    dispatch({ type: 'delete-attempt', attemptId });
    notify('已清除這次作答紀錄');
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
            <button
              type="button"
              aria-pressed={subjectFilter === 'all'}
              onClick={() => setSubjectFilter('all')}
            >
              全部 <span>{state.attempts.length}</span>
            </button>
            {subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                aria-pressed={subjectFilter === subject.id}
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
                aria-pressed={subjectFilter === 'mixed'}
                onClick={() => setSubjectFilter('mixed')}
              >
                跨科目 <span>{mixedCount}</span>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      <section className={styles.panel}>
        {!hydrated ? (
          <EmptyState icon={IconLoader2} title="正在讀取紀錄" description="請稍候。" />
        ) : groups.length ? (
          <div className={styles.list}>
            {groups.map(({ key, entries, ordinalById }) => {
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
                          <div className={styles.stats}>
                            <span>
                              答對 <strong>{attempt.correctCount}</strong>
                            </span>
                            <span>
                              答錯 <strong>{attempt.wrongCount}</strong>
                            </span>
                            <span>
                              未答 <strong>{attempt.unansweredCount}</strong>
                            </span>
                            <span>
                              時間{' '}
                              <strong>{formatDuration(attempt.elapsedSeconds)}</strong>
                            </span>
                          </div>
                          {attemptQuestions.length ? (
                            <details className={styles.attemptReview}>
                              <summary>
                                查看完整作答紀錄（{attemptQuestions.length}）
                              </summary>
                              <AttemptReview
                                attempt={attempt}
                                questions={attemptQuestions}
                                embedded
                              />
                            </details>
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
        ) : (
          <EmptyState
            icon={IconHistory}
            title={state.attempts.length ? '此科目還沒有作答紀錄' : '還沒有作答紀錄'}
            description={
              state.attempts.length
                ? '切換其他科目，或查看全部已作答紀錄。'
                : '完成並交卷後，結果會保存在這裡。'
            }
            action={
              state.attempts.length ? (
                <Button variant="primary" onClick={() => setSubjectFilter('all')}>
                  查看全部紀錄
                </Button>
              ) : (
                <Button variant="primary" render={<Link href="/papers" />}>
                  開始第一份試卷
                </Button>
              )
            }
          />
        )}
      </section>
    </>
  );
}
