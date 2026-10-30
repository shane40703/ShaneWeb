import type { ReactNode } from 'react';
import { HubLayout } from '@/components/layout/hub-layout';
import { personalHub } from './personal-pages';

/** Frame for the pages 我的作答存摺 gathers: a way back to the hub above the page. */
export function PersonalLayout({ children }: { children: ReactNode }) {
  return <HubLayout hub={personalHub}>{children}</HubLayout>;
}
