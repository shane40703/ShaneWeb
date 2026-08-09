import { AppearanceSettings } from '@/pages/appearance';
import { useAppState } from '@/state/app-state';
import styles from './settings-page.module.css';

const sizes = [14, 16, 18, 20, 22, 24];

export function SettingsPanel() {
  const { state, dispatch } = useAppState();
  const { questionFontSize, optionFontSize } = state.readingPreferences;

  return (
    <section className={styles.page}>
      <details className={styles.settingSection}>
        <summary>
          <span>閱讀設定</span>
          <small>調整題目與選項字體大小</small>
        </summary>
        <div className={styles.sectionContent}>
          <div className={styles.controls}>
            <FontSizeControl
              label="題目字體"
              value={questionFontSize}
              onChange={(size) =>
                dispatch({ type: 'set-reading-font-size', target: 'question', size })
              }
            />
            <FontSizeControl
              label="選項字體"
              value={optionFontSize}
              onChange={(size) =>
                dispatch({ type: 'set-reading-font-size', target: 'option', size })
              }
            />
          </div>
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

function FontSizeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <strong>{value}px</strong>
      <input
        type="range"
        min={14}
        max={24}
        step={2}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        list={`${label}-sizes`}
      />
      <datalist id={`${label}-sizes`}>
        {sizes.map((size) => <option key={size} value={size} />)}
      </datalist>
    </label>
  );
}
