import Head from 'next/head';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { useAppState } from '@/state/app-state';
import styles from '@/features/settings/settings-page.module.css';

const sizes = [14, 16, 18, 20, 22, 24];

export default function SettingsPage() {
  const { state, dispatch } = useAppState();
  const { questionFontSize, optionFontSize } = state.readingPreferences;

  return (
    <>
      <Head><title>閱讀設定｜建築師考試</title></Head>
      <section className={styles.page}>
        <header>
          <IconAdjustmentsHorizontal size={26} stroke={2} aria-hidden="true" />
          <div>
            <span>READING PREFERENCES</span>
            <h2>閱讀設定</h2>
            <p>題目與選項可分別調整字體大小，設定會保存在目前瀏覽器。</p>
          </div>
        </header>
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
      </section>
    </>
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
