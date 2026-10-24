import { AppearanceSettings } from '@/pages/appearance';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { ReadingFontControls } from '@/components/reading-font-controls';
import { useAppState } from '@/state/app-state';
import styles from './settings-page.module.css';

// The preview shows the real answer rows (the same component as 考古題討論版 and 已作答紀錄), so any
// change to that component shows up here too.
const PREVIEW_QUESTION = {
  options: ['選項文字可單獨調整大小', '設定會自動套用到作答與複習頁面'],
  answerKey: { kind: 'accepted', options: [] },
} as const;

export function SettingsPanel() {
  const { state } = useAppState();
  const { questionFontSize } = state.readingPreferences;

  return (
    <section className={styles.page}>
      <details className={styles.settingSection}>
        <summary>
          <span>閱讀設定</span>
          <small>調整題目與選項字體大小</small>
        </summary>
        <div className={styles.sectionContent}>
          <ReadingFontControls className={styles.controls} />
          <div className={styles.preview}>
            <span>預覽</span>
            <p style={{ fontSize: questionFontSize }}>
              建築師考試題目文字會以這個大小顯示。
            </p>
            <QuestionAnswerPanel
              question={PREVIEW_QUESTION}
              heading={null}
              ariaLabel="預覽選項"
            />
          </div>
        </div>
      </details>
      <details className={styles.settingSection}>
        <summary>
          <span>介面配色設定</span>
          <small>選擇淺色、深色模式與自訂配色</small>
        </summary>
        <div className={styles.appearanceContent}>
          <AppearanceSettings embedded />
        </div>
      </details>
    </section>
  );
}
