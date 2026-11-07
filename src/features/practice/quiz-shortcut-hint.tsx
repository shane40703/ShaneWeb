import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from '@tabler/icons-react';
import styles from './practice-page.module.css';

export function QuizShortcutHint({ daily = false }: { daily?: boolean }) {
  return (
    <p className={styles.shortcutHint}>
      <span className={styles.shortcutKeys}>
        <kbd><IconArrowUp size={12} aria-hidden="true" /><span className={styles.visuallyHidden}>上</span></kbd>
        <kbd><IconArrowDown size={12} aria-hidden="true" /><span className={styles.visuallyHidden}>下</span></kbd>
        <span>選答案・</span>
        <kbd><IconArrowLeft size={12} aria-hidden="true" /><span className={styles.visuallyHidden}>左</span></kbd>
        <kbd><IconArrowRight size={12} aria-hidden="true" /><span className={styles.visuallyHidden}>右</span></kbd>
        <span>換題・</span><kbd>空白</kbd><span>刪去／恢復</span>
      </span>
      <span className={styles.shortcutKeys}>
        <kbd>Ctrl / ⌘</kbd><span>＋</span><kbd>Enter</kbd>
        <span>{daily ? '確認／下一題／完成練習' : '交卷'}</span>
      </span>
    </p>
  );
}
