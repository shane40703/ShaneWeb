import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  IconBooks, IconBuildingSkyscraper, IconDeviceMobilePlus, IconFileText, IconBrandThreads, IconSettings, IconShield,
} from '@tabler/icons-react';
import { isPlainClick } from '@/components/in-page-link';
import { examsReturnHref } from '@/features/exams/exams-last-place';
import { personalHub, personalPages } from '@/features/personal/personal-pages';
import { examsHubName, examsPlace } from '@/lib/question-path';
import { SITE_NAME } from '@/lib/site';
import { practiceHub, practicePages } from '@/features/practice/practice-pages';
import { resourcePages, resourcesHub } from '@/features/resources/resource-pages';
import styles from './app-shell.module.css';

/**
 * `href` is the section the item stays current in, and what it links for search engines and new
 * tabs; `land`, when set, is where a plain click goes instead, read at the click.
 */
interface NavigationLinkItem { href: string; land?: () => string; label: string; icon: typeof IconFileText; pages?: readonly { href: string }[] }
// Every page links 考古題討論版's board, /exams; a plain click returns to the place the reader
// last saw in it, or on a first visit opens the newest 法規 paper's first question.
const primaryNavigation: readonly NavigationLinkItem[] = [
  { href: practiceHub.href, label: practiceHub.label, icon: practiceHub.icon },
  { href: '/exams', land: examsReturnHref, label: '考古題討論版', icon: IconBooks },
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
  return titledPages.find(item => isActive(path, item.href))?.label ?? SITE_NAME;
}

interface NavigationProps {
  pathname: string;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
  onAddToHomeScreen?: () => void;
}

function NavigationLink({ item, pathname, onNavigate, onOpenSettings }: NavigationProps & { item: NavigationLinkItem }) {
  const router = useRouter();
  const { land } = item;
  // Fetched ahead as the link itself would be; where it lands is read again at the click.
  const prefetch = land ? () => void router.prefetch(land()) : undefined;
  return <Link href={item.href} className={styles.navItem}
    aria-current={isCurrent(pathname, item) ? 'page' : undefined}
    onMouseEnter={prefetch} onTouchStart={prefetch} onFocus={prefetch}
    onClick={event => {
      if (item.href === '/settings' && onOpenSettings) { event.preventDefault(); onOpenSettings(); }
      else if (land && isPlainClick(event)) {
        event.preventDefault();
        // Already in the section: the place on screen is the one it would return to. The
        // sidebar's path, which a click away has already moved on, so this click takes it back.
        if (!isCurrent(pathname, item)) void router.push(land());
      }
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
    <Link href="/" className={styles.brand} aria-label={`${SITE_NAME}首頁`} onClick={() => props.onNavigate?.()}>
      <span className={styles.brandMark} aria-hidden="true"><IconBuildingSkyscraper size={25} stroke={1.9} /></span>
      <span className={styles.brandCopy}><strong>{SITE_NAME}</strong><small>考古題練習平台</small></span>
    </Link>
    <Navigation {...props} />
  </div>;
}
