import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/ui';
import { getSubject } from '@/data/questions';
import type { Question } from '@/lib/types';
import styles from './content.module.css';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
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

export function DifficultButton({
  active,
  onClick,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      className={active ? styles.difficultActive : styles.difficult}
      aria-pressed={active}
      aria-label={active ? '取消難題標記' : '標記為難題'}
    >
      <span aria-hidden="true">💡</span>
      {compact ? (active ? '已標記' : '標記難題') : active ? '已標記難題' : '標記為難題'}
    </Button>
  );
}

export function QuestionCard({
  question,
  difficult,
  onToggleDifficult,
  action,
}: {
  question: Question;
  difficult: boolean;
  onToggleDifficult: () => void;
  action?: ReactNode;
}) {
  const subject = getSubject(question.subject);
  return (
    <article className={styles.questionRow}>
      <div className={styles.questionContent}>
        <div className={styles.tagList}>
          <Tag>{question.year} 年</Tag>
          <Tag tone="green">{subject?.shortName}</Tag>
          <Tag tone="purple">第 {question.questionNumber} 題</Tag>
          <Tag tone="orange">{question.primaryCategory}</Tag>
        </div>
        <h2>{question.text}</h2>
      </div>
      <div className={styles.questionActions}>
        <DifficultButton active={difficult} onClick={onToggleDifficult} compact />
        {action ?? (
          <Button variant="primary" render={<Link href={`/community?question=${question.id}`} />}>
            查看詳解
          </Button>
        )}
      </div>
    </article>
  );
}
