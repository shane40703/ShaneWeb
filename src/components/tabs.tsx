import { createContext, useContext, type ReactNode } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import styles from './tabs.module.css';

const TabsLabelContext = createContext<string | undefined>(undefined);

/** Tab strip: a translucent list closed by a rule, the active tab opaque over an ink-blue line. */
export function TabsRoot<T extends string>({
  value,
  onValueChange,
  ariaLabel,
  children,
}: {
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <TabsLabelContext.Provider value={ariaLabel}>
      <Tabs.Root
        className={styles.root}
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
      >
        {children}
      </Tabs.Root>
    </TabsLabelContext.Provider>
  );
}

export function TabList({ children }: { children: ReactNode }) {
  const ariaLabel = useContext(TabsLabelContext);
  return (
    <Tabs.List className={styles.list} aria-label={ariaLabel} activateOnFocus>
      {children}
      <Tabs.Indicator className={styles.indicator} renderBeforeHydration />
    </Tabs.List>
  );
}

export function Tab({
  value,
  children,
  badge,
  disabled,
}: {
  value: string;
  children: ReactNode;
  /** A count beside the label, in the mono label style. */
  badge?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tabs.Tab className={styles.tab} value={value} disabled={disabled}>
      {children}
      {badge !== undefined && badge !== null ? (
        <span className={styles.badge}>{badge}</span>
      ) : null}
    </Tabs.Tab>
  );
}

export function TabPanel({
  value,
  keepMounted,
  children,
  className,
}: {
  value: string;
  keepMounted?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Panel
      className={className ? `${styles.panel} ${className}` : styles.panel}
      value={value}
      keepMounted={keepMounted}
    >
      {children}
    </Tabs.Panel>
  );
}
