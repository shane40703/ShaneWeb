import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { SideDrawer } from '@/components/ui/ui';
import styles from './app-shell.module.css';

const navigation = [
  { href: '/', label: '首頁', symbol: '⌂' },
  { href: '/papers', label: '歷屆試題', symbol: '▤' },
  { href: '/random', label: '隨機出題', symbol: '⤨' },
  { href: '/analysis', label: '考題分析', symbol: '▥' },
  { href: '/community', label: '詳解與討論', symbol: '◎' },
  { href: '/notes', label: '使用者筆記', symbol: '✎' },
  { href: '/difficult', label: '難題標記', symbol: '💡' },
  { href: '/history', label: '已作答紀錄', symbol: '◷' },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="建築師考試首頁">
      <span className={styles.brandMark}>築</span>
      <span className={styles.brandCopy}>
        <strong>建築師考試</strong>
        <small>考古題練習平台</small>
      </span>
    </Link>
  );
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className={styles.navigation} aria-label="主要功能">
      {navigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          className={styles.navItem}
        >
          <span className={styles.navSymbol} aria-hidden="true">
            {item.symbol}
          </span>
          <span className={styles.navLabel}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className={styles.sidebarInner}>
      <Brand />
      <Navigation pathname={pathname} onNavigate={onNavigate} />
      <aside className={styles.studyCard}>
        <div className={styles.planGraphic} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <strong>專注每一題</strong>
        <p>練習紀錄、筆記與難題標記只保留在這台裝置。</p>
      </aside>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = router.pathname;
  const currentPage = navigation.find((item) => isActive(pathname, item.href));
  const pageTitle = pathname === '/quiz' ? '作答頁' : currentPage?.label ?? '建築師考試';

  return (
    <div className={styles.shell}>
      <aside className={styles.desktopSidebar}>
        <SidebarContent pathname={pathname} />
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
              <SidebarContent pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </SideDrawer>
            <span className={styles.pageTitle}>{pageTitle}</span>
          </div>
          <span className={styles.anonymousBadge}>免登入・本機保存</span>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
