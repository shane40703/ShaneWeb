import { type ComponentProps, type ReactNode, useState } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { IconLayoutGrid, IconX } from '@tabler/icons-react';
import { QuestionNumberPicker } from '@/components/question-selector';
import { Button } from '@/components/ui/ui';
import styles from './question-map-drawer.module.css';

/** A long paper would otherwise open the sheet with the current tile below its fold. */
function showCurrentTile(popup: HTMLElement | null) {
  popup
    ?.querySelector('[aria-pressed="true"]')
    ?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
}

/**
 * The 題號導覽 of a one-column page as a bottom sheet: a 題號 button opens it, inside are the
 * same number tiles as the aside (QuestionNumberPicker), and choosing one navigates and closes
 * it. The sheet is not kept mounted, so the tiles exist in the DOM only while it is open.
 */
export function QuestionMapDrawer({
  current,
  total,
  questions,
  value,
  onValueChange,
  showStatusLegend,
  triggerClassName,
  footer,
}: {
  /** 1-based position of the current question in the paper, shown beside the title. */
  current: number;
  total: number;
  questions: ComponentProps<typeof QuestionNumberPicker>['questions'];
  value: string;
  onValueChange: (questionId: string) => void;
  showStatusLegend?: boolean;
  triggerClassName?: string;
  /** Stays in view under the tiles, however long they scroll; `close` shuts the sheet. */
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="down">
      <Drawer.Trigger
        render={
          <Button className={triggerClassName}>
            <IconLayoutGrid size={17} stroke={2} aria-hidden="true" />
            題號
          </Button>
        }
      />
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Viewport className={styles.viewport}>
          <Drawer.Popup className={styles.popup} ref={showCurrentTile}>
            <header className={styles.header}>
              <Drawer.Title className={styles.title}>題號導覽</Drawer.Title>
              <strong className={styles.position}>
                {current}/{total}
              </strong>
              <Drawer.Close
                render={
                  <Button variant="icon" aria-label="關閉">
                    <IconX size={18} stroke={2} aria-hidden="true" />
                  </Button>
                }
              />
            </header>
            <QuestionNumberPicker
              questions={questions}
              value={value}
              onValueChange={(questionId) => {
                onValueChange(questionId);
                setOpen(false);
              }}
              showStatusLegend={showStatusLegend}
            />
            {footer ? (
              <footer className={styles.footer}>{footer(() => setOpen(false))}</footer>
            ) : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
