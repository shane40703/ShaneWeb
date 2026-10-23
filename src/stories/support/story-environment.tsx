import type { Decorator } from '@storybook/nextjs-vite';
import type { CSSProperties, ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import shellStyles from '@/components/layout/app-shell.module.css';
import { Providers } from '@/components/providers';
import { writeStoredNoteImages } from '@/lib/note-image-storage';
import { STORAGE_KEY } from '@/lib/study';
import { THEME_MODE_STORAGE_KEY } from '@/lib/theme';
import type { AppState } from '@/lib/types';
import { useAppState } from '@/state/app-state';
import { createStoryState } from '../fixtures/app-state';
import { applyCloudMode, isCloudMode } from './cloud-sync';
import { setStoryFetchMocks, type FetchMock } from './mock-fetch';

/** 故事可用的 parameters（見 src/stories/AGENTS.md）。 */
export interface StoryEnvironmentParameters {
  /** 本機作答資料：答題、難題、筆記、筆記圖片、作答紀錄、字級……沒給就是全新使用者。 */
  appState?: Partial<AppState>;
  /** 其他 localStorage 內容，例如練習進度；字串原樣存入，其他值存成 JSON。 */
  localStorage?: Record<string, unknown>;
  sessionStorage?: Record<string, unknown>;
  fetchMocks?: readonly FetchMock[];
}

const appKeyPrefixes = ['shaneweb', 'shane-web'];

function clearAppKeys(storage: Storage) {
  for (const key of Object.keys(storage)) {
    if (appKeyPrefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
}

function writeEntries(storage: Storage, entries: Record<string, unknown> | undefined) {
  for (const [key, value] of Object.entries(entries ?? {})) {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}

/**
 * 每個故事開始前把瀏覽器裡的網站資料換成這個故事的設定，網站元件照常從
 * localStorage／IndexedDB 讀取，所以畫面跟實際網站走同一條路。
 */
export async function prepareStoryEnvironment(parameters: StoryEnvironmentParameters) {
  setStoryFetchMocks(parameters.fetchMocks);
  const state = createStoryState(parameters.appState);
  clearAppKeys(window.localStorage);
  clearAppKeys(window.sessionStorage);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  writeEntries(window.localStorage, parameters.localStorage);
  writeEntries(window.sessionStorage, parameters.sessionStorage);
  try {
    await writeStoredNoteImages(state.noteImages);
  } catch {
    // 沒有 IndexedDB 時，筆記圖片仍會從 localStorage 的資料讀到。
  }
}

/** 等本機資料讀進來才畫故事，筆記等「掛載時讀一次」的元件才看得到範例資料。 */
function HydrationGate({ children }: { children: ReactNode }) {
  const { state, hydrated } = useAppState();
  if (!hydrated) return null;
  return (
    <div
      style={
        {
          display: 'contents',
          '--question-font-size': `${state.readingPreferences.questionFontSize}px`,
          '--option-font-size': `${state.readingPreferences.optionFontSize}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * 全域：跟網站一樣的 Providers。主題跟著工具列的「主題」切換，登入狀態跟著「雲端同步」
 * （見 cloud-sync.ts）。
 */
export const withStoryProviders: Decorator = (Story, context) => {
  const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
  const cloud = isCloudMode(context.globals.cloud) ? context.globals.cloud : 'local';
  // ThemeProvider 掛載時從 localStorage 讀主題；換主題或登入狀態時用 key 重新掛載。
  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, theme);
  applyCloudMode(cloud);
  return (
    <Providers key={`${theme}-${cloud}`}>
      <HydrationGate>
        <Story />
      </HydrationGate>
    </Providers>
  );
};

/**
 * Layouts 用：把故事放進網站的側欄與頂部列（AppShell），外面跟 _app.tsx 一樣包
 * `.app-root`。工具列「外框」切到「隱藏」時只保留主內容區的寬度與留白，方便專心調整版面。
 */
export const withPageFrame: Decorator = (Story, context) => (
  <div className="app-root">
    {context.globals.shell === 'hide' ? (
      <main className={shellStyles.main}>
        <Story />
      </main>
    ) : (
      <AppShell>
        <Story />
      </AppShell>
    )}
  </div>
);

type RouteQuery = Record<string, string | string[]>;

function searchOf(query: RouteQuery) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }
  return search.toString();
}

/**
 * Layouts 的 parameters：全版面顯示，並讓側欄與頂部列標示目前頁面。
 * - meta 裡一律寫成 `parameters: { ...pageParameters('/網址') }`：meta 有 JSDoc 註解時，
 *   Storybook 會另外加一個 parameters，直接寫函式呼叫的那個會被蓋掉。
 * - 動態路由（例如 `/resources/memory-gallery/[[...category]]`）傳實際網址當 asPath，
 *   路由參數放在 query。
 * - 故事的 parameters 會跟 meta 的合併：故事只能改 query 的值，不能拿掉 meta 有的參數。
 */
export function pageParameters(
  pathname: string,
  query: RouteQuery = {},
  asPath?: string,
) {
  const search = searchOf(query);
  return {
    layout: 'fullscreen' as const,
    nextjs: {
      router: {
        pathname,
        asPath: asPath ?? (search ? `${pathname}?${search}` : pathname),
        query,
      },
    },
  };
}
