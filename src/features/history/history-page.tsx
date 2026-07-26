import Link from 'next/link';
import { IconHistory, IconLoader2, IconTrash } from '@tabler/icons-react';
import { AttemptReview } from '@/components/attempt-review';
import { EmptyState, PageHeader, Tag } from '@/components/content/content';
import { Button, ConfirmDialog, useToast } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import { questionPathFromId } from '@/lib/question-path';
import { formatDuration, getAttemptScopeKey } from '@/lib/study';
import type { Question, QuizAttempt } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import styles from './history-page.module.css';

function formatDate(iso: string) {
  const taipeiTime = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  const [date, time] = taipeiTime.toISOString().slice(0, 16).split('T');
  return `${date.replaceAll('-', '/')} ${time}`;
}

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
            new Date(left.submittedAt).getTime() -
            new Date(right.submittedAt).getTime(),
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

export function HistoryPage({ questions }: { questions: Question[] }) {
  const { state, dispatch, hydrated } = useAppState();
  const { notify } = useToast();
  const groups = groupAttempts(state.attempts);

  function deleteAttempt(attemptId: string) {
    dispatch({ type: 'delete-attempt', attemptId });
    notify('已清除這次作答紀錄');
  }

  return (
    <>
      <PageHeader
        eyebrow="ATTEMPT HISTORY"
        title="已作答紀錄"
        description="同一份試卷集中在同一區塊，可展開檢討或清除指定的一次紀錄。"
      />
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
                      <Button
                        variant="primary"
                        render={<Link href={retryHref(first)} />}
                      >
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
                      const ordinal = ordinalById.get(attempt.id) ?? 1;
                      const accuracy = attempt.questionIds.length
                        ? Math.round(
                            (attempt.correctCount / attempt.questionIds.length) * 100,
                          )
                        : 0;

                      return (
                        <section className={styles.attempt} key={attempt.id}>
                          <header>
                            <div>
                              <h3>第 {ordinal} 次</h3>
                              <time dateTime={attempt.submittedAt}>
                                {formatDate(attempt.submittedAt)}
                              </time>
                            </div>
                            <div className={styles.score}>
                              <strong>{accuracy}%</strong>
                              <span>正確率</span>
                            </div>
                          </header>
                          <div className={styles.stats}>
                            <span>答對 <strong>{attempt.correctCount}</strong></span>
                            <span>答錯 <strong>{attempt.wrongCount}</strong></span>
                            <span>未答 <strong>{attempt.unansweredCount}</strong></span>
                            <span>時間 <strong>{formatDuration(attempt.elapsedSeconds)}</strong></span>
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
    </>
  );
}
