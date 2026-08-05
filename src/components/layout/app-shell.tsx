import Link from 'next/link';
import { useRouter } from 'next/router';
import { type CSSProperties, useState } from 'react';
import {
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconBulb,
  IconChartPie,
  IconDeviceFloppy,
  IconFileText,
  IconFlag,
  IconHistory,
  IconHome,
  IconMessages,
  IconNotebook,
  IconScale,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-react';
import { SideDrawer } from '@/components/ui/ui';
import { useAppState } from '@/state/app-state';
import { ThemeToggle } from './theme-toggle';
import styles from './app-shell.module.css';

const persistenceMessages = {
  'quota-exceeded':
    '瀏覽器儲存空間已滿，最新的作答、筆記或配色沒有存檔。請刪除部分筆記圖片後再試一次。',
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
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className={styles.navigation} aria-label="主要功能">
      <NavigationGroup items={primaryNavigation} pathname={pathname} onNavigate={onNavigate} />
      <div className={styles.utilityNavigation}>
        <NavigationGroup items={utilityNavigation} pathname={pathname} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function NavigationGroup({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly (typeof navigation)[number][];
  pathname: string;
  onNavigate?: () => void;
}) {
  return items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onNavigate}
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
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className={styles.sidebarInner}>
      <Brand />
      <Navigation pathname={pathname} onNavigate={onNavigate} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useAppState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = router.pathname;
  const navigationPath = pathname === '/appearance' ? '/settings' : pathname;
  const currentPage = navigation.find((item) =>
    isActive(navigationPath, item.href),
  );
  const pageTitle = pathname.startsWith('/questions/')
    ? '作答頁'
    : (currentPage?.label ?? '建築師考試');

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
        <SidebarContent pathname={navigationPath} />
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
              />
            </SideDrawer>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
          </div>
          <div className={styles.topbarActions}>
            <ThemeToggle />
            <span className={styles.anonymousBadge}>
              <IconDeviceFloppy size={15} stroke={2} aria-hidden="true" />
              免登入・本機保存
            </span>
          </div>
        </header>
        <main className={styles.main}>
          <PersistenceWarning />
          {children}
        </main>
      </div>
    </div>
  );
}
