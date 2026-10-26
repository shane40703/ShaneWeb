import styles from './original-option-label.module.css';

export function originalOptionText(index: number | undefined) {
  return index !== undefined && Number.isInteger(index) && index >= 0 && index < 26
    ? `（原選項 ${String.fromCharCode(65 + index)}）`
    : undefined;
}

/** A secondary, readable reference to the paper's letter, never part of the answer value. */
export function OriginalOptionLabel({ index }: { index: number | undefined }) {
  const text = originalOptionText(index);
  return text ? <span className={styles.label}>{text}</span> : null;
}
