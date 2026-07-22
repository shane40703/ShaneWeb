import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/ui';
import { getSubject } from '@/data/questions';
import type { AnswerRecord, Question } from '@/lib/types';
import styles from './content.module.css';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}

export function Tag({ children, tone = 'blue' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={styles.tag} data-tone={tone}>
      {children}
    </span>
  );
}

export function EmptyState({
  symbol,
  title,
  description,
  action,
}: {
  symbol: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptySymbol} aria-hidden="true">
        {symbol}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function QuestionRow({
  question,
  answer,
  difficult,
  onToggleDifficult,
}: {
  question: Question;
  answer?: AnswerRecord;
  difficult: boolean;
  onToggleDifficult: () => void;
}) {
  const subject = getSubject(question.subject);
  return (
    <article className={styles.questionRow}>
      <div className={styles.questionContent}>
        <div className={styles.tagList}>
          <Tag>{question.year} 年</Tag>
          <Tag tone="green">{subject?.shortName}</Tag>
          <Tag tone="purple">{question.topic}</Tag>
        </div>
        <h2>{question.text}</h2>
        <p>
          {answer ? (answer.correct ? '最近作答：答對' : '最近作答：答錯') : '尚未作答'}
        </p>
      </div>
      <div className={styles.questionActions}>
        <Button
          variant="icon"
          aria-label={difficult ? '取消難題標記' : '加入難題標記'}
          title={difficult ? '取消難題標記' : '加入難題標記'}
          onClick={onToggleDifficult}
          className={difficult ? styles.starActive : styles.star}
        >
          <span aria-hidden="true">★</span>
        </Button>
        <Button variant="primary" render={<Link href={`/practice?question=${question.id}`} />}>
          開始作答
        </Button>
      </div>
    </article>
  );
}

export function ComingSoon({
  eyebrow,
  title,
  description,
  symbol,
}: {
  eyebrow: string;
  title: string;
  description: string;
  symbol: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className={styles.comingSoon}>
        <div className={styles.blueprintGrid} aria-hidden="true" />
        <span className={styles.comingSymbol} aria-hidden="true">
          {symbol}
        </span>
        <span className={styles.eyebrow}>NEXT PHASE</span>
        <h2>這個功能正在搭建中</h2>
        <p>目前已保留正式網址與導覽位置，下一階段可直接接上完整功能。</p>
        <Button variant="primary" render={<Link href="/practice" />}>
          先開始練習
        </Button>
      </section>
    </>
  );
}
