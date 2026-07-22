'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button, SideDrawer, useToast } from '@/components/ui/ui';
import { useAppState } from '@/state/app-state';
import styles from './app-shell.module.css';

const navigation = [
  { href: '/', label: '首頁', symbol: '⌂' },
  { href: '/papers', label: '歷屆試題', symbol: '▤' },
  { href: '/practice', label: '隨機出題', symbol: '⤨' },
  { href: '/analysis', label: '考題分析', symbol: '▥' },
  { href: '/community', label: '匿名詳解與討論', symbol: '◎' },
  { href: '/notes', label: '使用者筆記', symbol: '✎' },
  { href: '/difficult', label: '難題標記', symbol: '☆' },
  { href: '/history', label: '已作答紀錄', symbol: '◷' },
  { href: '/settings', label: '網頁介面設定', symbol: '⚙' },
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
        <strong>準備建築師考試</strong>
        <p>從歷屆題目、弱點分析與重複練習開始。</p>
      </aside>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { state, dispatch } = useAppState();
  const { notify } = useToast();
  const currentPage = navigation.find((item) => isActive(pathname, item.href));

  function toggleTheme() {
    const theme = state.preferences.theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'update-preferences', preferences: { theme } });
    notify(theme === 'dark' ? '已切換為深色模式' : '已切換為亮色模式');
  }

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
            <span className={styles.pageTitle}>{currentPage?.label ?? '建築師考試'}</span>
          </div>
          <div className={styles.topbarActions}>
            <span className={styles.anonymousBadge}>免登入・裝置端使用</span>
            <Button
              variant="icon"
              onClick={toggleTheme}
              aria-label={state.preferences.theme === 'dark' ? '切換為亮色模式' : '切換為深色模式'}
              title={state.preferences.theme === 'dark' ? '切換為亮色模式' : '切換為深色模式'}
            >
              <span aria-hidden="true">{state.preferences.theme === 'dark' ? '☀' : '◐'}</span>
            </Button>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
