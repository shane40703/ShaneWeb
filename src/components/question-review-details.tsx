import { useState, type ReactNode } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

/** Subscribe to shared posts and create the note editor only after opening a row. */
export function QuestionReviewDetails({
  className, label, children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  return <details className={className} onToggle={event => {
    if (event.currentTarget.open) setOpened(true);
  }}>
    <summary>
      <span>{label}</span>
      <IconChevronDown size={18} stroke={2} aria-hidden="true" />
    </summary>
    {opened ? children : null}
  </details>;
}
