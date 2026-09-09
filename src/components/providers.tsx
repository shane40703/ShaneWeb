import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { CloudSyncProvider } from '@/components/cloud-sync-provider';
import { AppStateProvider } from '@/state/app-state';
import { ToastProvider } from '@/components/ui/ui';
import { AccountPreferencesSync } from '@/components/account-preferences-sync';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <CloudSyncProvider>
        <ThemeProvider>
          <AccountPreferencesSync />
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </CloudSyncProvider>
    </AppStateProvider>
  );
}
