import { IconBulb } from '@tabler/icons-react';
import { Button } from '@/components/ui/ui';
import styles from './difficult-button.module.css';

export function DifficultButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={styles.button}
      aria-pressed={active}
      aria-label={active ? '取消難題標記' : '標記為難題'}
    >
      <IconBulb size={18} stroke={2} aria-hidden="true" />
      {active ? '已標記難題' : '標記為難題'}
    </Button>
  );
}
