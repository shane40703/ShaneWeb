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
  href,
  onClick,
}: {
  children: ReactNode;
  ariaLabel: string;
  active: boolean;
  answered?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const commonProps = {
    className: styles.button,
    'aria-label': ariaLabel,
    'data-answered': answered || undefined,
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
