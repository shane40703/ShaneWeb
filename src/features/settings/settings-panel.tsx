import Link from 'next/link';
import { IconChevronRight } from '@tabler/icons-react';
import { AppearanceSettings } from '@/pages/appearance';
import { isPlainClick } from '@/components/in-page-link';
import { QuestionAnswerPanel } from '@/components/question-answer-panel';
import { ReadingFontControls } from '@/components/reading-font-controls';
import { useAppState } from '@/state/app-state';
import styles from './settings-page.module.css';

// The preview shows the real answer rows (the same component as 考古題討論版 and 歷屆試題作答履歷), so any
// change to that component shows up here too.
const PREVIEW_QUESTION = {
  options: ['選項文字可單獨調整大小', '設定會自動套用到作答與複習頁面'],
  answerKey: { kind: 'accepted', options: [] },
} as const;

export function SettingsPanel({
  onNavigate,
}: {
  /** Called when a plain click leaves for another page, so the settings dialog can close. */
  onNavigate?: () => void;
}) {
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
      {/* The section keeps the spacing and the dashed rule; the link is only the row, so its
          focus ring leaves the rule out. */}
      <div className={styles.settingSection}>
        <Link
          href="/licenses"
          className={styles.linkRow}
          onClick={(event) => {
            if (isPlainClick(event)) onNavigate?.();
          }}
        >
          <span className={styles.linkText}>
            <span className={styles.linkTitle}>開源授權</span>
            <small>網站程式碼的授權，以及用到的字型、資料和第三方套件</small>
          </span>
          <IconChevronRight size={20} stroke={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
