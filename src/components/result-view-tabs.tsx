import styles from './result-view-tabs.module.css';

export type ResultView = 'review' | 'wrong-analysis';

export function ResultViewTabs({
  value,
  onValueChange,
  idPrefix,
  ariaLabel,
  reviewLabel = '逐題作答結果',
  analysisLabel = '錯題統計結果',
}: {
  value: ResultView;
  onValueChange: (value: ResultView) => void;
  idPrefix: string;
  ariaLabel: string;
  reviewLabel?: string;
  analysisLabel?: string;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
      <button
        type="button"
        id={`${idPrefix}-review-tab`}
        role="tab"
        aria-selected={value === 'review'}
        aria-controls={`${idPrefix}-review-panel`}
        onClick={() => onValueChange('review')}
      >
        {reviewLabel}
      </button>
      <button
        type="button"
        id={`${idPrefix}-wrong-analysis-tab`}
        role="tab"
        aria-selected={value === 'wrong-analysis'}
        aria-controls={`${idPrefix}-wrong-analysis-panel`}
        onClick={() => onValueChange('wrong-analysis')}
      >
        {analysisLabel}
      </button>
    </div>
  );
}
