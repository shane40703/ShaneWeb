import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { CloudSyncProvider } from '@/components/cloud-sync-provider';
import { AppStateProvider } from '@/state/app-state';
import { ToastProvider } from '@/components/ui/ui';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <CloudSyncProvider>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </CloudSyncProvider>
    </AppStateProvider>
  );
}
