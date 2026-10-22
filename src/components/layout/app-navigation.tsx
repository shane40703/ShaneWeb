import Link from 'next/link';
import { useRef, useState, type Ref } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  IconBuildingSkyscraper, IconBulb, IconChartPie, IconChevronRight, IconDatabase,
  IconFileText, IconFlag, IconHistory, IconMessages, IconNotebook, IconPhoto,
  IconRepeat, IconScale, IconSettings, IconSparkles, IconTargetArrow, IconX,
} from '@tabler/icons-react';
import styles from './app-shell.module.css';

interface NavigationLinkItem { href: string; label: string; icon: typeof IconFileText }
interface NavigationSectionItem { id: string; label: string; icon: typeof IconFileText; items: readonly NavigationLinkItem[] }
const primaryNavigation: readonly (NavigationLinkItem | NavigationSectionItem)[] = [
  { href: '/daily', label: '每日練習', icon: IconTargetArrow },
  { id: 'practice', label: '歷屆試題題練習', icon: IconFileText, items: [
    { href: '/papers', label: '歷屆試題', icon: IconFileText },
    { href: '/random', label: '隨機出題', icon: IconSparkles },
    { href: '/law-cloze', label: '法規克漏字', icon: IconFileText },
  ] },
  { id: 'resources', label: '歷屆試題資料集成', icon: IconDatabase, items: [
    { href: '/analysis', label: '考題分析', icon: IconChartPie },
    { href: '/memory-gallery', label: '速記圖庫', icon: IconPhoto },
    { href: '/laws', label: '法規資料庫', icon: IconScale },
  ] },
  { href: '/community', label: '詳解與討論', icon: IconMessages },
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navigationPageTitle(pathname: string) {
  if (pathname === '/') return '首頁';
  if (pathname.startsWith('/questions/')) return '作答頁';
  const path = pathname === '/appearance' ? '/settings' : pathname;
  return navigationLinks.find(item => isActive(path, item.href))?.label ?? '建築師考試';
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
  const active = section.items.some(item => isActive(props.pathname, item.href));
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger className={`${styles.navItem} ${styles.navSectionTrigger}`} data-active={active || undefined}
      openOnHover={!props.inDrawer} delay={150} closeDelay={180} aria-haspopup={false}>
      <span className={styles.navSymbol} aria-hidden="true"><section.icon size={20} stroke={1.9} /></span>
      <span className={styles.navLabel}>{section.label}</span>
      <IconChevronRight className={styles.navChevron} size={15} aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner className={styles.navPositioner} side={props.inDrawer ? 'bottom' : 'right'} align="start" sideOffset={8} collisionPadding={12}>
        <Popover.Popup className={styles.navPopup} role="group" aria-label={`${section.label}子選單`}
          initialFocus={type => type === 'keyboard' ? firstLink.current : false}>
          <div className={styles.navPopupHeading}><strong>{section.label}</strong>
            <Popover.Close className={styles.navPopupClose} aria-label={`關閉${section.label}子選單`}><IconX size={16} aria-hidden="true" /></Popover.Close>
          </div>
          {section.items.map((item, index) => <NavigationLink key={item.href} {...props} item={item}
            linkRef={index === 0 ? firstLink : undefined} onNavigate={() => { onOpenChange(false); props.onNavigate?.(); }} />)}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
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
  const pathname = props.pathname.startsWith('/questions/') ? '/papers' : props.pathname;
  return <div className={styles.sidebarInner}>
    <Link href="/" className={styles.brand} aria-label="建築師考試首頁" onClick={() => props.onNavigate?.()}>
      <span className={styles.brandMark} aria-hidden="true"><IconBuildingSkyscraper size={25} stroke={1.9} /></span>
      <span className={styles.brandCopy}><strong>建築師考試</strong><small>考古題練習平台</small></span>
    </Link>
    <Navigation key={pathname} {...props} pathname={pathname} />
  </div>;
}
