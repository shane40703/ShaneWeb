import Link from 'next/link';
import { IconHistory, IconLoader2 } from '@tabler/icons-react';
import { EmptyState, PageHeader, Tag } from '@/components/content/content';
import { Button } from '@/components/ui/ui';
import { getQuestion, getSubject } from '@/data/questions';
import { formatDuration } from '@/lib/study';
import { useAppState } from '@/state/app-state';
import styles from './history-page.module.css';

function formatDate(iso: string) {
  const taipeiTime = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  const [date, time] = taipeiTime.toISOString().slice(0, 16).split('T');
  return `${date.replaceAll('-', '/')} ${time}`;
}

export function HistoryPage() {
  const { state, hydrated } = useAppState();

  return (
    <>
      <PageHeader
        eyebrow="ATTEMPT HISTORY"
        title="已作答紀錄"
        description="每次交卷才會新增一筆紀錄；所有資料只保存在目前瀏覽器。"
      />
      <section className={styles.panel}>
        {!hydrated ? (
          <EmptyState icon={IconLoader2} title="正在讀取紀錄" description="請稍候。" />
        ) : state.attempts.length ? (
          <div className={styles.list}>
            {state.attempts.map((attempt) => {
              const subject = attempt.subject === 'mixed' ? null : getSubject(attempt.subject);
              const wrongQuestions = attempt.questionIds
                .map((id) => getQuestion(id))
                .filter(
                  (question) =>
                    Boolean(question) &&
                    attempt.answers[question!.id] !== undefined &&
                    attempt.answers[question!.id] !== question!.answer,
                );
              const retryHref =
                attempt.mode === 'paper' && attempt.subject !== 'mixed' && attempt.year
                  ? `/quiz?subject=${attempt.subject}&year=${attempt.year}`
                  : `/quiz?mode=random&questions=${attempt.questionIds.join(',')}`;
              return (
                <article className={styles.attempt} key={attempt.id}>
                  <header>
                    <div>
                      <div className={styles.tags}>
                        <Tag tone={attempt.mode === 'paper' ? 'blue' : 'purple'}>{attempt.mode === 'paper' ? '歷屆試題' : '隨機題組'}</Tag>
                        {subject ? <Tag tone="green">{subject.name}</Tag> : <Tag tone="green">跨科目</Tag>}
                        {attempt.year ? <Tag>{attempt.year} 年</Tag> : null}
                      </div>
                      <h2>{subject?.name ?? '跨科目練習'}{attempt.year ? `・民國 ${attempt.year} 年` : ''}</h2>
                      <time dateTime={attempt.submittedAt}>{formatDate(attempt.submittedAt)}</time>
                    </div>
                    <div className={styles.score}><strong>{attempt.questionIds.length ? Math.round((attempt.correctCount / attempt.questionIds.length) * 100) : 0}%</strong><span>正確率</span></div>
                  </header>
                  <div className={styles.stats}>
                    <span>答對 <strong>{attempt.correctCount}</strong></span>
                    <span>答錯 <strong>{attempt.wrongCount}</strong></span>
                    <span>未答 <strong>{attempt.unansweredCount}</strong></span>
                    <span>時間 <strong>{formatDuration(attempt.elapsedSeconds)}</strong></span>
                  </div>
                  {wrongQuestions.length ? (
                    <details>
                      <summary>查看答錯題目（{wrongQuestions.length}）</summary>
                      <div>
                        {wrongQuestions.map((question) => question && (
                          <Link key={question.id} href={`/community?question=${question.id}`}>
                            第 {question.questionNumber} 題・{question.text}
                          </Link>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <Button variant="primary" render={<Link href={retryHref} />}>再做一次</Button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={IconHistory} title="還沒有作答紀錄" description="完成並交卷後，結果會保存在這裡。" action={<Button variant="primary" render={<Link href="/papers" />}>開始第一份試卷</Button>} />
        )}
      </section>
    </>
  );
}
