import { AppearanceSettings } from '@/pages/appearance';
import { ReadingFontControls } from '@/components/reading-font-controls';
import { useAppState } from '@/state/app-state';
import styles from './settings-page.module.css';

export function SettingsPanel() {
  const { state } = useAppState();
  const { questionFontSize, optionFontSize } = state.readingPreferences;

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
            <ol style={{ fontSize: optionFontSize }}>
              <li>A　選項文字可單獨調整大小</li>
              <li>B　設定會自動套用到作答與複習頁面</li>
            </ol>
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
