import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './question-number-button.module.css';

export function QuestionNumberGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** What the marks on an answer sheet's tiles mean. */
export function QuestionSheetLegend() {
  return (
    <div className={styles.legend} role="note" aria-label="題號標記說明">
      <span>
        <i data-mark="filled" aria-hidden="true">B</i>
        已作答
      </span>
      <span>
        <i data-mark="difficult" aria-hidden="true" />
        難題
      </span>
      <span>
        <i data-mark="review" aria-hidden="true" />
        待檢查
      </span>
    </div>
  );
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
  sheet = false,
  answer,
  review = false,
  stateLabel,
  href,
  replace = false,
  shallow = false,
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
  /** An answer sheet, before any verdict: the fill means filled in, not correct. */
  sheet?: boolean;
  /** On a sheet, the letter chosen. */
  answer?: string;
  /** On a sheet, marked to look at again. */
  review?: boolean;
  /** Said first among the statuses, e.g. 已作答 or 未作答, which colour alone shows otherwise. */
  stateLabel?: string;
  href?: string;
  /** Moves within the page without adding a history entry. */
  replace?: boolean;
  /** Stays on the loaded page, with no request and so no failure when offline. */
  shallow?: boolean;
  onClick?: () => void;
}) {
  const statusText = [
    stateLabel ?? null,
    wrong ? '答錯' : null,
    difficult ? '已標記難題' : null,
    noted ? '有筆記' : null,
    hasContent ? '有詳解或討論' : null,
    review ? '待檢查' : null,
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
    'data-sheet': sheet || undefined,
    'data-filled': Boolean(answer) || undefined,
    'data-review': review || undefined,
  };
  const label = answer ? (
    <>
      <span>{children}</span>
      <strong>{answer}</strong>
    </>
  ) : (
    children
  );

  if (href) {
    return (
      <Link
        {...commonProps}
        href={href}
        replace={replace}
        shallow={shallow}
        prefetch={shallow ? false : undefined}
        aria-current={active ? 'step' : undefined}
      >
        {label}
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
      {label}
    </button>
  );
}
