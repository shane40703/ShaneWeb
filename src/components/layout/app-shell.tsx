import { useRouter } from 'next/router';
import { type CSSProperties, useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconCloud,
  IconCloudCheck,
  IconDeviceFloppy,
  IconLoader2,
  IconLogout,
  IconX,
} from '@tabler/icons-react';
import { SideDrawer } from '@/components/ui/ui';
import { useCloudSync } from '@/components/cloud-sync-provider';
import { SettingsPanel } from '@/features/settings/settings-panel';
import { useAppState } from '@/state/app-state';
import { ThemeToggle } from './theme-toggle';
import { navigationPageTitle, SidebarContent } from './app-navigation';
import styles from './app-shell.module.css';

const persistenceMessages = {
  'quota-exceeded':
    '瀏覽器儲存空間已滿，最新的作答、筆記或配色沒有存檔。請清除不需要的舊紀錄後再試一次。',
  unavailable:
    '這個瀏覽器不允許本機儲存，重新整理後作答紀錄、筆記與配色不會保留。',
} as const;

function PersistenceWarning() {
  const { persistence } = useAppState();
  if (persistence === 'saved') return null;
  return (
    <p className={styles.persistenceWarning} role="alert">
      <IconAlertTriangle size={17} stroke={2} aria-hidden="true" />
      {persistenceMessages[persistence]}
    </p>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useAppState();
  const cloud = useCloudSync();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = router.pathname;
  const navigationPath = pathname === '/appearance' ? '/settings' : pathname;
  const pageTitle = navigationPageTitle(pathname);
  const answeringPaper = pathname === '/practice/mock-exam' && router.query.q !== undefined;

  useEffect(() => {
    if (!settingsOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [settingsOpen]);

  return (
    <div
      className={styles.shell}
      data-answering-paper={answeringPaper || undefined}
      style={
        {
          '--question-font-size': `${state.readingPreferences.questionFontSize}px`,
          '--option-font-size': `${state.readingPreferences.optionFontSize}px`,
        } as CSSProperties
      }
    >
      <aside className={styles.desktopSidebar}>
        <SidebarContent
          pathname={navigationPath}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <SideDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              triggerLabel="開啟選單"
              title="主要功能"
              triggerClassName={styles.answeringPaperMenu}
            >
              <SidebarContent
                pathname={navigationPath}
                onNavigate={() => setDrawerOpen(false)}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            </SideDrawer>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
          </div>
          <div className={styles.topbarActions}>
            <ThemeToggle />
            {cloud.status === 'disabled' ? (
              <span className={styles.anonymousBadge}>
                <IconDeviceFloppy size={15} stroke={2} aria-hidden="true" />
                免登入・本機保存
              </span>
            ) : cloud.user ? (
              <button
                type="button"
                className={styles.cloudAccountButton}
                onClick={() => void cloud.signOut()}
                title={cloud.error || '按一下登出；作答紀錄已保留在雲端與本機'}
              >
                {cloud.status === 'syncing' ? (
                  <IconLoader2 size={16} stroke={2} aria-hidden="true" />
                ) : (
                  <IconCloudCheck size={16} stroke={2} aria-hidden="true" />
                )}
                <span>
                  {cloud.status === 'syncing'
                    ? '同步中'
                    : cloud.user.displayName || '已同步'}
                </span>
                <IconLogout size={14} stroke={2} aria-hidden="true" />
              </button>
            ) : (
              <div className={styles.cloudSignIn}>
                <button
                  type="button"
                  className={styles.cloudAccountButton}
                  onClick={() => void cloud.signIn()}
                  disabled={cloud.status === 'syncing'}
                  title={cloud.error || '登入後可跨裝置同步已完成的作答紀錄'}
                >
                  {cloud.status === 'syncing' ? (
                    <IconLoader2 size={16} stroke={2} aria-hidden="true" />
                  ) : (
                    <IconCloud size={16} stroke={2} aria-hidden="true" />
                  )}
                  <span>{cloud.status === 'syncing' ? '登入中' : '同步作答'}</span>
                </button>
                {cloud.error ? (
                  <span className={styles.cloudError} role="alert">{cloud.error}</span>
                ) : null}
              </div>
            )}
          </div>
        </header>
        <main className={styles.main}>
          <PersistenceWarning />
          {children}
        </main>
      </div>
      {settingsOpen ? (
        <div
          className={styles.settingsDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-dialog-title"
        >
          <button
            type="button"
            className={styles.settingsBackdrop}
            aria-label="關閉設定"
            onClick={() => setSettingsOpen(false)}
          />
          <section className={styles.settingsPopup}>
            <header>
              <div>
                <span>SETTINGS</span>
                <h2 id="settings-dialog-title">設定</h2>
              </div>
              <button
                type="button"
                aria-label="關閉設定"
                onClick={() => setSettingsOpen(false)}
                autoFocus
              >
                <IconX size={22} stroke={2} aria-hidden="true" />
              </button>
            </header>
            <div className={styles.settingsBody}>
              <SettingsPanel />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
