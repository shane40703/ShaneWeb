import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { IconBulb, IconExternalLink, type TablerIcon } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import { getSubject } from '@/question-bank/catalog';
import { getQuestionDisplayCategory } from '@/lib/study';
import type { Question } from '@/lib/types';
import styles from './content.module.css';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <header
      className={styles.pageHeader}
      data-compact={compact || undefined}
    >
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
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: TablerIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptySymbol} aria-hidden="true">
        <Icon size={32} stroke={1.8} />
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
      <IconBulb size={18} stroke={2} aria-hidden="true" />
      {compact ? (active ? '已標記' : '標記難題') : active ? '已標記難題' : '標記為難題'}
    </Button>
  );
}

export function QuestionPrompt({
  question,
  compact = false,
}: {
  question: Pick<Question, 'content'>;
  compact?: boolean;
}) {
  return (
    <div className={styles.questionPrompt} data-compact={compact || undefined}>
      {question.content.map((block, index) =>
        block.kind === 'text' ? (
          <p className={styles.questionPromptText} key={`text-${index}`}>
            {block.text}
          </p>
        ) : (
          <figure className={styles.questionPromptImage} key={`image-${index}`}>
            <Image
              src={block.src}
              alt={block.alt}
              width={block.width}
              height={block.height}
              loading={compact ? 'lazy' : 'eager'}
              sizes={compact ? '(max-width: 720px) 100vw, 560px' : '(max-width: 900px) 100vw, 820px'}
            />
          </figure>
        ),
      )}
    </div>
  );
}

export function QuestionSourceLine({ question }: { question: Question }) {
  if (question.source.kind === 'sample') {
    return <span className={styles.questionSource}>示範題・非完整官方試卷資料</span>;
  }
  return (
    <a
      className={styles.questionSource}
      href={question.source.questionUrl}
      target="_blank"
      rel="noreferrer"
    >
      資料來源：考選部・試題 {question.source.paperCode}・第 {question.source.page} 頁
      <IconExternalLink size={14} stroke={2} aria-hidden="true" />
    </a>
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
          <Tag tone="orange">{getQuestionDisplayCategory(question)}</Tag>
          {question.source.kind === 'sample' ? (
            <Tag tone="purple">示範題</Tag>
          ) : null}
        </div>
        <QuestionPrompt question={question} compact />
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
