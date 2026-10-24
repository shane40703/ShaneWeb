import Link from 'next/link';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import {
  IconBooks, IconBuildingSkyscraper, IconBulb, IconChevronRight, IconFileText, IconFlag,
  IconHistory, IconNotebook, IconRepeat, IconSettings,
} from '@tabler/icons-react';
import { practiceHub, practicePages } from '@/features/practice/practice-pages';
import { resourcePages, resourcesHub } from '@/features/resources/resource-pages';
import styles from './app-shell.module.css';

interface NavigationLinkItem { href: string; label: string; icon: typeof IconFileText }
interface NavigationSectionItem { id: string; label: string; icon: typeof IconFileText; items: readonly NavigationLinkItem[] }
const primaryNavigation: readonly (NavigationLinkItem | NavigationSectionItem)[] = [
  { href: practiceHub.href, label: practiceHub.label, icon: practiceHub.icon },
  { href: '/exams', label: '考古題討論版', icon: IconBooks },
  { href: resourcesHub.href, label: resourcesHub.label, icon: resourcesHub.icon },
  { id: 'personal', label: '我的作答存摺', icon: IconNotebook, items: [
    { href: '/notes', label: '使用者筆記', icon: IconNotebook },
    { href: '/difficult', label: '難題標記', icon: IconBulb },
    { href: '/wrong', label: '常錯題目', icon: IconRepeat },
    { href: '/history', label: '已作答紀錄', icon: IconHistory },
  ] },
];
const utilityNavigation: readonly NavigationLinkItem[] = [
  { href: '/settings', label: '設定', icon: IconSettings },
  { href: '/report', label: '問題回報', icon: IconFlag },
];
const navigationLinks = [...primaryNavigation.flatMap(item => 'items' in item ? item.items : [item]), ...utilityNavigation];
// Hub pages (statistics and practice) open from their hub instead of the sidebar but still
// title the topbar; listed first so they win over their hub's shorter prefix.
const titledPages = [...resourcePages, ...practicePages, ...navigationLinks];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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
  inDrawer?: boolean;
}

function NavigationLink({ item, pathname, onNavigate, onOpenSettings, linkRef }: NavigationProps & { item: NavigationLinkItem; linkRef?: Ref<HTMLAnchorElement> }) {
  return <Link ref={linkRef} href={item.href} className={styles.navItem}
    aria-current={isActive(pathname, item.href) ? 'page' : undefined}
    onClick={event => {
      if (item.href === '/settings' && onOpenSettings) { event.preventDefault(); onOpenSettings(); }
      onNavigate?.();
    }}>
    <span className={styles.navSymbol} aria-hidden="true"><item.icon size={20} stroke={1.9} /></span>
    <span className={styles.navLabel}>{item.label}</span>
  </Link>;
}

function NavigationSection({ section, open, onOpenChange, ...props }: NavigationProps & {
  section: NavigationSectionItem; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const firstLink = useRef<HTMLAnchorElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const active = section.items.some(item => isActive(props.pathname, item.href));
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (open && focusOnOpen.current) firstLink.current?.focus();
    focusOnOpen.current = false;
  }, [open]);

  function hover(next: boolean) {
    if (props.inDrawer) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => onOpenChange(next), next ? 150 : 180);
  }

  return <div className={styles.navSection} data-open={open || undefined}
    onMouseEnter={() => hover(true)} onMouseLeave={() => hover(false)}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !open) return;
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(hoverTimer.current);
      onOpenChange(false);
      trigger.current?.focus();
    }}>
    <button type="button" ref={trigger} id={`${id}-trigger`}
      className={`${styles.navItem} ${styles.navSectionTrigger}`} data-active={active || undefined}
      aria-expanded={open} aria-controls={`${id}-items`}
      onClick={event => {
        clearTimeout(hoverTimer.current);
        focusOnOpen.current = !open && event.detail === 0;
        onOpenChange(!open);
      }}>
      <span className={styles.navSymbol} aria-hidden="true"><section.icon size={20} stroke={1.9} /></span>
      <span className={styles.navLabel}>{section.label}</span>
      <IconChevronRight className={styles.navChevron} size={15} aria-hidden="true" />
    </button>
    {open ? <div id={`${id}-items`} className={styles.navSectionItems} role="group" aria-label={`${section.label}子選單`}>
      {section.items.map((item, index) => <NavigationLink key={item.href} {...props} item={item}
        linkRef={index === 0 ? firstLink : undefined} onNavigate={() => {
          clearTimeout(hoverTimer.current);
          onOpenChange(false);
          props.onNavigate?.();
        }} />)}
    </div> : null}
  </div>;
}

function Navigation(props: NavigationProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  return <nav className={styles.navigation} aria-label="主要功能">
    {primaryNavigation.map(item => 'items' in item ? <NavigationSection key={item.id} {...props} section={item} open={openSection === item.id}
      onOpenChange={open => setOpenSection(current => open ? item.id : current === item.id ? null : current)} /> :
      <NavigationLink key={item.href} {...props} item={item} onNavigate={() => { setOpenSection(null); props.onNavigate?.(); }} />)}
    <div className={styles.utilityNavigation}>
      {utilityNavigation.map(item => <NavigationLink key={item.href} {...props} item={item}
        onNavigate={() => { setOpenSection(null); props.onNavigate?.(); }} />)}
    </div>
  </nav>;
}

export function SidebarContent(props: NavigationProps) {
  const { pathname } = props;
  return <div className={styles.sidebarInner}>
    <Link href="/" className={styles.brand} aria-label="建築師考試首頁" onClick={() => props.onNavigate?.()}>
      <span className={styles.brandMark} aria-hidden="true"><IconBuildingSkyscraper size={25} stroke={1.9} /></span>
      <span className={styles.brandCopy}><strong>建築師考試</strong><small>考古題練習平台</small></span>
    </Link>
    <Navigation key={pathname} {...props} pathname={pathname} />
  </div>;
}
