'use client';

import { ConfirmDialog, Button, SimpleSelect, ToggleSwitch, useToast } from '@/components/ui/ui';
import { PageHeader } from '@/components/content/content';
import { STORAGE_KEY } from '@/lib/study';
import { useAppState } from '@/state/app-state';
import styles from './settings-page.module.css';

const fontOptions = [
  { value: 'normal', label: '標準' },
  { value: 'large', label: '較大' },
] as const;

export function SettingsPage() {
  const { state, dispatch } = useAppState();
  const { notify } = useToast();

  function resetData() {
    window.localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'reset' });
    notify('示範資料已重設', '作答、難題與介面偏好已恢復預設值。');
  }

  return (
    <>
      <PageHeader
        eyebrow="PREFERENCES"
        title="網頁介面設定"
        description="調整閱讀體驗與預設答題方式。所有設定只會保留在目前裝置。"
      />
      <div className={styles.settingsGrid}>
        <section className={styles.settingsCard}>
          <header className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true">
              ◐
            </span>
            <div>
              <span>APPEARANCE</span>
              <h2>外觀</h2>
            </div>
          </header>
          <div className={styles.controlList}>
            <ToggleSwitch
              label="深色模式"
              description="降低夜間閱讀時的畫面亮度"
              checked={state.preferences.theme === 'dark'}
              onCheckedChange={(checked) =>
                dispatch({
                  type: 'update-preferences',
                  preferences: { theme: checked ? 'dark' : 'light' },
                })
              }
            />
            <SimpleSelect
              label="字體大小"
              value={state.preferences.fontScale}
              options={fontOptions}
              onValueChange={(fontScale) =>
                dispatch({ type: 'update-preferences', preferences: { fontScale } })
              }
            />
            <ToggleSwitch
              label="收合左側功能欄"
              description="在桌面版保留更多內容空間"
              checked={state.preferences.sidebarCollapsed}
              onCheckedChange={(sidebarCollapsed) =>
                dispatch({
                  type: 'update-preferences',
                  preferences: { sidebarCollapsed },
                })
              }
            />
          </div>
        </section>

        <section className={styles.settingsCard}>
          <header className={styles.cardHeader}>
            <span className={styles.cardIcon} data-tone="green" aria-hidden="true">
              ✓
            </span>
            <div>
              <span>PRACTICE</span>
              <h2>作答偏好</h2>
            </div>
          </header>
          <div className={styles.controlList}>
            <ToggleSwitch
              label="預設立即顯示解析"
              description="送出答案後直接查看正確答案與說明"
              checked={state.preferences.instantFeedback}
              onCheckedChange={(instantFeedback) =>
                dispatch({
                  type: 'update-preferences',
                  preferences: { instantFeedback },
                })
              }
            />
            <div className={styles.infoRow}>
              <span aria-hidden="true">i</span>
              <p>關閉後，所有題目的解析會集中在完成練習時顯示。</p>
            </div>
          </div>
        </section>

        <section className={`${styles.settingsCard} ${styles.dataCard}`}>
          <header className={styles.cardHeader}>
            <span className={styles.cardIcon} data-tone="orange" aria-hidden="true">
              ⟲
            </span>
            <div>
              <span>LOCAL DATA</span>
              <h2>資料管理</h2>
            </div>
          </header>
          <div className={styles.dataSummary}>
            <div>
              <strong>{Object.keys(state.answers).length}</strong>
              <span>已作答題目</span>
            </div>
            <div>
              <strong>{state.difficultQuestionIds.length}</strong>
              <span>難題標記</span>
            </div>
            <div>
              <strong>{state.history.length}</strong>
              <span>作答紀錄</span>
            </div>
          </div>
          <p className={styles.dataDescription}>
            清除後無法復原。舊版原型使用的資料不會被讀取或刪除。
          </p>
          <ConfirmDialog
            trigger={
              <Button variant="danger" fullWidth>
                清除示範資料
              </Button>
            }
            title="確定要清除示範資料嗎？"
            description="這會移除新版網站中的作答、難題與介面偏好，並恢復所有預設值。"
            confirmLabel="確認清除"
            onConfirm={resetData}
          />
        </section>
      </div>
      <section className={styles.privacyCard}>
        <span className={styles.privacyIcon} aria-hidden="true">
          ◎
        </span>
        <div>
          <strong>你的資料留在這台裝置</strong>
          <p>目前版本沒有帳號、伺服器資料庫或跨裝置同步功能。</p>
        </div>
        <code>{STORAGE_KEY}</code>
      </section>
    </>
  );
}
