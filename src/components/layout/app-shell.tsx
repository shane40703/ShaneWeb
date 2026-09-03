import Link from 'next/link';
import { useRouter } from 'next/router';
import { type CSSProperties, useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconBulb,
  IconChartPie,
  IconCloud,
  IconCloudCheck,
  IconDeviceFloppy,
  IconFileText,
  IconFlag,
  IconHistory,
  IconHome,
  IconLoader2,
  IconLogout,
  IconMessages,
  IconNotebook,
  IconScale,
  IconSettings,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { SideDrawer } from '@/components/ui/ui';
import { useCloudSync } from '@/components/cloud-sync-provider';
import { SettingsPanel } from '@/features/settings/settings-panel';
import { useAppState } from '@/state/app-state';
import { ThemeToggle } from './theme-toggle';
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

const primaryNavigation = [
  { href: '/', label: '首頁', icon: IconHome },
  { href: '/papers', label: '歷屆試題', icon: IconFileText },
  { href: '/random', label: '隨機出題', icon: IconSparkles },
  { href: '/analysis', label: '考題分析', icon: IconChartPie },
  { href: '/community', label: '詳解與討論', icon: IconMessages },
  { href: '/notes', label: '使用者筆記', icon: IconNotebook },
  { href: '/difficult', label: '難題標記', icon: IconBulb },
  { href: '/history', label: '已作答紀錄', icon: IconHistory },
  { href: '/laws', label: '法規資料庫', icon: IconScale },
] as const;

const utilityNavigation = [
  { href: '/settings', label: '設定', icon: IconSettings },
  { href: '/report', label: '問題回報', icon: IconFlag },
] as const;

const navigation = [...primaryNavigation, ...utilityNavigation] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="建築師考試首頁">
      <span className={styles.brandMark} aria-hidden="true">
        <IconBuildingSkyscraper size={25} stroke={1.9} />
      </span>
      <span className={styles.brandCopy}>
        <strong>建築師考試</strong>
        <small>考古題練習平台</small>
      </span>
    </Link>
  );
}

function Navigation({
  pathname,
  onNavigate,
  onOpenSettings,
}: {
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <nav className={styles.navigation} aria-label="主要功能">
      <NavigationGroup items={primaryNavigation} pathname={pathname} onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      <div className={styles.utilityNavigation}>
        <NavigationGroup items={utilityNavigation} pathname={pathname} onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      </div>
    </nav>
  );
}

function NavigationGroup({
  items,
  pathname,
  onNavigate,
  onOpenSettings,
}: {
  items: readonly (typeof navigation)[number][];
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
}) {
  return items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={(event) => {
        if (item.href === '/settings' && onOpenSettings) {
          event.preventDefault();
          onOpenSettings();
        }
        onNavigate?.();
      }}
      aria-current={isActive(pathname, item.href) ? 'page' : undefined}
      className={styles.navItem}
    >
      <span className={styles.navSymbol} aria-hidden="true">
        <item.icon size={20} stroke={1.9} />
      </span>
      <span className={styles.navLabel}>{item.label}</span>
    </Link>
  ));
}

function SidebarContent({
  pathname,
  onNavigate,
  onOpenSettings,
}: {
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <div className={styles.sidebarInner}>
      <Brand />
      <Navigation pathname={pathname} onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
    </div>
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
  const currentPage = navigation.find((item) =>
    isActive(navigationPath, item.href),
  );
  const pageTitle = pathname.startsWith('/questions/')
    ? '作答頁'
    : (currentPage?.label ?? '建築師考試');

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
