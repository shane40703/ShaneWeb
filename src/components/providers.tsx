import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { AppStateProvider } from '@/state/app-state';
import { ToastProvider } from '@/components/ui/ui';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </AppStateProvider>
  );
}
