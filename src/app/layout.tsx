import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from '@/components/providers';
import { STORAGE_KEY } from '@/lib/study';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '建築師考試｜考古題練習平台',
    template: '%s｜建築師考試',
  },
  description: '以歷屆試題、隨機練習與個人作答紀錄準備建築師考試。',
};

const preferenceScript = `
try {
  const raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  const state = raw ? JSON.parse(raw) : null;
  if (state?.version === 2 && state.preferences) {
    document.documentElement.dataset.theme = state.preferences.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.fontScale = state.preferences.fontScale === 'large' ? 'large' : 'normal';
    document.documentElement.dataset.sidebar = state.preferences.sidebarCollapsed ? 'collapsed' : 'expanded';
  }
} catch {}
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="zh-Hant"
      data-theme="light"
      data-font-scale="normal"
      data-sidebar="expanded"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>
        <div className="app-root">
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </div>
      </body>
    </html>
  );
}
