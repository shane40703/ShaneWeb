import Link from 'next/link';
import {
  IconBooks, IconBuildingSkyscraper, IconFileText, IconFlag, IconSettings,
} from '@tabler/icons-react';
import { personalHub, personalPages } from '@/features/personal/personal-pages';
import { practiceHub, practicePages } from '@/features/practice/practice-pages';
import { resourcePages, resourcesHub } from '@/features/resources/resource-pages';
import styles from './app-shell.module.css';

interface NavigationLinkItem { href: string; label: string; icon: typeof IconFileText; pages?: readonly { href: string }[] }
const primaryNavigation: readonly NavigationLinkItem[] = [
  { href: practiceHub.href, label: practiceHub.label, icon: practiceHub.icon },
  { href: '/exams', label: '考古題討論版', icon: IconBooks },
  { href: resourcesHub.href, label: resourcesHub.label, icon: resourcesHub.icon },
  // Its pages keep their own top-level URLs, so the hub stays current on them by name.
  { href: personalHub.href, label: personalHub.label, icon: personalHub.icon, pages: personalPages },
];
const utilityNavigation: readonly NavigationLinkItem[] = [
  { href: '/settings', label: '設定', icon: IconSettings },
  { href: '/report', label: '問題回報', icon: IconFlag },
];
// Hub pages (statistics, practice and 我的作答存摺) open from their hub instead of the sidebar
// but still title the topbar; listed first so they win over their hub's shorter prefix.
const titledPages = [...resourcePages, ...practicePages, ...personalPages, ...primaryNavigation, ...utilityNavigation];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isCurrent(pathname: string, item: NavigationLinkItem) {
  return [item, ...(item.pages ?? [])].some(({ href }) => isActive(pathname, href));
}

export function navigationPageTitle(pathname: string) {
  if (pathname === '/') return '首頁';
  const path = pathname === '/appearance' ? '/settings' : pathname;
  return titledPages.find(item => isActive(path, item.href))?.label ?? '建築師考試';
}

interface NavigationProps {
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
}

function NavigationLink({ item, pathname, onNavigate, onOpenSettings }: NavigationProps & { item: NavigationLinkItem }) {
  return <Link href={item.href} className={styles.navItem}
    aria-current={isCurrent(pathname, item) ? 'page' : undefined}
    onClick={event => {
      if (item.href === '/settings' && onOpenSettings) { event.preventDefault(); onOpenSettings(); }
      onNavigate?.();
    }}>
    <span className={styles.navSymbol} aria-hidden="true"><item.icon size={20} stroke={1.9} /></span>
    <span className={styles.navLabel}>{item.label}</span>
  </Link>;
}

function Navigation(props: NavigationProps) {
  return <nav className={styles.navigation} aria-label="主要功能">
    {primaryNavigation.map(item => <NavigationLink key={item.href} {...props} item={item} />)}
    <div className={styles.utilityNavigation}>
      {utilityNavigation.map(item => <NavigationLink key={item.href} {...props} item={item} />)}
    </div>
  </nav>;
}

export function SidebarContent(props: NavigationProps) {
  return <div className={styles.sidebarInner}>
    <Link href="/" className={styles.brand} aria-label="建築師考試首頁" onClick={() => props.onNavigate?.()}>
      <span className={styles.brandMark} aria-hidden="true"><IconBuildingSkyscraper size={25} stroke={1.9} /></span>
      <span className={styles.brandCopy}><strong>建築師考試</strong><small>考古題練習平台</small></span>
    </Link>
    <Navigation {...props} />
  </div>;
}
