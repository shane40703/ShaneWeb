import Link from 'next/link';
import {
  IconBooks, IconBuildingSkyscraper, IconDeviceMobilePlus, IconFileText, IconBrandThreads, IconSettings, IconShield,
} from '@tabler/icons-react';
import { personalHub, personalPages } from '@/features/personal/personal-pages';
import { examsHref, examsHubName, examsPlace } from '@/lib/question-path';
import { subjects, years } from '@/question-bank/catalog';
import { practiceHub, practicePages } from '@/features/practice/practice-pages';
import { resourcePages, resourcesHub } from '@/features/resources/resource-pages';
import styles from './app-shell.module.css';

/** `href` is the section the item stays current in; `to`, when set, is where a click lands in it. */
interface NavigationLinkItem { href: string; to?: string; label: string; icon: typeof IconFileText; pages?: readonly { href: string }[] }
// 考古題討論版 opens on the newest 法規 paper's first question, as it did before it had overview
// pages; /exams itself, the list of subjects, is the top of its 返回 links.
const examsStart = examsHref([subjects[0].id, String(years[0]), '1']);
const primaryNavigation: readonly NavigationLinkItem[] = [
  { href: practiceHub.href, label: practiceHub.label, icon: practiceHub.icon },
  { href: '/exams', to: examsStart, label: '考古題討論版', icon: IconBooks },
  { href: resourcesHub.href, label: resourcesHub.label, icon: resourcesHub.icon },
  // Its pages keep their own top-level URLs, so the hub stays current on them by name.
  { href: personalHub.href, label: personalHub.label, icon: personalHub.icon, pages: personalPages },
];
const utilityNavigation: readonly NavigationLinkItem[] = [
  { href: '/settings', label: '設定', icon: IconSettings },
  { href: '/community', label: '社群連結', icon: IconBrandThreads },
  { href: '/privacy', label: '隱私權政策', icon: IconShield },
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

const EXAMS_ROUTE = '/exams/[[...slug]]';

/** 考古題討論版 names its subject and paper pages like their tabs; itself and a question keep its name. */
function examsPageTitle(slug: string | string[] | undefined) {
  const place = examsPlace(slug);
  return place.kind === 'subject' || place.kind === 'paper' ? examsHubName(place) : '考古題討論版';
}

export function navigationPageTitle(pathname: string, query?: { slug?: string | string[] }) {
  if (pathname === '/') return '首頁';
  // The page for any address the site does not have, named like its tab.
  if (pathname === '/404') return '找不到頁面';
  // The route reads its place from the query (so do stories, on /exams?slug=); an address the
  // click is still on its way to, from its path.
  if (pathname === EXAMS_ROUTE || (pathname === '/exams' && query?.slug)) return examsPageTitle(query?.slug);
  if (pathname === '/exams' || pathname.startsWith('/exams/')) return examsPageTitle(pathname.split('/').slice(2));
  const path = pathname === '/appearance' ? '/settings' : pathname;
  return titledPages.find(item => isActive(path, item.href))?.label ?? '建築師考試';
}

interface NavigationProps {
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
  onAddToHomeScreen?: () => void;
}

function NavigationLink({ item, pathname, onNavigate, onOpenSettings }: NavigationProps & { item: NavigationLinkItem }) {
  return <Link href={item.to ?? item.href} className={styles.navItem}
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
      {props.onAddToHomeScreen ? <button type="button" className={styles.navItem}
        onClick={() => { props.onAddToHomeScreen?.(); props.onNavigate?.(); }}>
        <span className={styles.navSymbol} aria-hidden="true"><IconDeviceMobilePlus size={20} stroke={1.9} /></span>
        <span className={styles.navLabel}>加入主畫面</span>
      </button> : null}
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
