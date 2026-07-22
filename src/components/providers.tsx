'use client';

import type { ReactNode } from 'react';
import { AppStateProvider } from '@/state/app-state';
import { ToastProvider } from '@/components/ui/ui';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <ToastProvider>{children}</ToastProvider>
    </AppStateProvider>
  );
}
