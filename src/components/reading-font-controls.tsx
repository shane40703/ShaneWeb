import { useId } from 'react';
import { useAppState } from '@/state/app-state';
import styles from './reading-font-controls.module.css';

const sizes = [14, 16, 18, 20, 22, 24];

export function ReadingFontControls({ className }: { className?: string }) {
  const id = useId();
  const { state, dispatch } = useAppState();

  return (
    <div className={[styles.controls, className].filter(Boolean).join(' ')}>
      {(['question', 'option'] as const).map((target) => {
        const label = target === 'question' ? '題目字體' : '選項字體';
        const value = state.readingPreferences[
          target === 'question' ? 'questionFontSize' : 'optionFontSize'
        ];
        const listId = `${id}-${target}-sizes`;
        return (
          <label key={target} className={styles.control}>
            <span>{label}</span>
            <strong>{value}px</strong>
            <input
              type="range"
              min={14}
              max={24}
              step={2}
              value={value}
              onChange={(event) => dispatch({
                type: 'set-reading-font-size', target, size: Number(event.target.value),
              })}
              aria-label={label}
              list={listId}
            />
            <datalist id={listId}>
              {sizes.map((size) => <option key={size} value={size} />)}
            </datalist>
          </label>
        );
      })}
    </div>
  );
}
