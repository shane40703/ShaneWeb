import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './question-number-button.module.css';

export function QuestionNumberGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

export function QuestionNumberButton({
  children,
  ariaLabel,
  active,
  answered = false,
  difficult = false,
  wrong = false,
  noted = false,
  hasContent = false,
  href,
  onClick,
}: {
  children: ReactNode;
  ariaLabel: string;
  active: boolean;
  answered?: boolean;
  difficult?: boolean;
  wrong?: boolean;
  noted?: boolean;
  hasContent?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const statusText = [
    wrong ? '答錯' : null,
    difficult ? '已標記難題' : null,
    noted ? '有筆記' : null,
    hasContent ? '有詳解或討論' : null,
  ].filter(Boolean);
  const commonProps = {
    className: styles.button,
    'aria-label': statusText.length
      ? `${ariaLabel}（${statusText.join('、')}）`
      : ariaLabel,
    'data-answered': answered || undefined,
    'data-difficult': difficult || undefined,
    'data-wrong': wrong || undefined,
    'data-noted': noted || undefined,
    'data-content': hasContent || undefined,
  };

  if (href) {
    return (
      <Link
        {...commonProps}
        href={href}
        aria-current={active ? 'step' : undefined}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      {...commonProps}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
