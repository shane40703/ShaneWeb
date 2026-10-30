import type { ReactNode } from 'react';
import { HubLayout } from '@/components/layout/hub-layout';
import { practiceHub } from './practice-pages';

/**
 * Frame for the practice hub's pages: a way back to the hub instead of the resources
 * hub's section switcher. `narrow` follows the law cloze page, which centers itself.
 */
export function PracticeLayout({
  narrow = false,
  children,
}: {
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <HubLayout hub={practiceHub} narrow={narrow}>
      {children}
    </HubLayout>
  );
}
