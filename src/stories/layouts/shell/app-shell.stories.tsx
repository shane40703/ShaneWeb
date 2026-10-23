import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import { useRouter, type NextRouter } from 'next/router';
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import { useArgs } from 'storybook/preview-api';
import { AppShell } from '@/components/layout/app-shell';
import { PracticeHubPage } from '@/features/practice/practice-hub-page';
import { ResourcesPage } from '@/features/resources/resources-page';
import DifficultRoute from '@/pages/difficult';
import HistoryRoute from '@/pages/history';
import HomeRoute from '@/pages/index';
import ReportPage from '@/pages/report';
import SettingsPage from '@/pages/settings';
import WrongRoute from '@/pages/wrong';
import {
  attemptsAppState,
  notesAppState,
  personalAttempts,
  personalDifficultIds,
} from '../../fixtures/personal';
import { practiceOverview } from '../../fixtures/practice';
import { resourcesOverview } from '../../fixtures/resources';
import { failLocalStorageWrites } from '../../fixtures/shell';
import { StatefulRouter } from '../../support/stateful-router';
import { pageParameters } from '../../support/story-environment';
import { ExamsRoute } from '../exams/exams-route';
import { NotesRoute } from '../notes/notes-route';

/** 側欄連得到的頁面；有 getStaticProps 的頁面照其他 Layouts 故事用範例資料組出來。 */
const pages = {
  '/': { label: '首頁', content: <HomeRoute /> },
  '/practice': {
    label: '每日練習',
    content: <PracticeHubPage overview={practiceOverview} />,
  },
  '/exams': { label: '歷屆試題', content: <ExamsRoute /> },
  '/resources': {
    label: '統計分析',
    content: <ResourcesPage overview={resourcesOverview} />,
  },
  '/notes': { label: '使用者筆記', content: <NotesRoute /> },
  '/difficult': { label: '難題標記', content: <DifficultRoute /> },
  '/wrong': { label: '常錯題目', content: <WrongRoute /> },
  '/history': { label: '已作答紀錄', content: <HistoryRoute /> },
  '/settings': { label: '設定', content: <SettingsPage /> },
  '/report': { label: '問題回報', content: <ReportPage /> },
} satisfies Record<string, { label: string; content: ReactNode }>;

type PagePath = keyof typeof pages;

function isPagePath(pathname: string): pathname is PagePath {
  return pathname in pages;
}

type ShellArgs = ComponentProps<typeof AppShell> & { page: PagePath };

/** 換到另一頁：側欄的「設定」在網站上是開啟設定視窗、不換頁，設定頁從 Controls 的 page 選。 */
function otherPage(pathname: string, page: PagePath): pathname is PagePath {
  return pathname !== page && pathname !== '/settings' && isPagePath(pathname);
}

/**
 * 換頁：Storybook 的 next/router 是固定的假路由，這裡換掉側欄與頂部列讀到的網址，
 * 並跟網站一樣讓外框保持掛載（設定視窗、抽屜照常開關）、只換主內容。
 * 頁面裡用網址參數換畫面（例如歷屆試題換題）交給 StatefulRouter。
 */
function SitePages({
  page,
  onPageChange,
}: {
  page: PagePath;
  /** 點連結換頁時更新 Controls 的 page。 */
  onPageChange: (page: PagePath) => void;
}) {
  const base = useRouter();
  // 點連結時連同網址參數一起記下；從 Controls 換頁時就是那一頁本身。
  const [visit, setVisit] = useState<{ page: PagePath; asPath: string }>({
    page,
    asPath: page,
  });
  const asPath = visit.page === page ? visit.asPath : page;

  const router = useMemo<NextRouter>(() => {
    const current = new URL(asPath, window.location.origin);
    const navigate =
      (method: 'push' | 'replace') =>
      (...[href, as, options]: Parameters<NextRouter['push']>) => {
        const target =
          typeof href === 'string'
            ? new URL(href, current)
            : new URL(href.pathname ?? current.pathname, current);
        if (!otherPage(target.pathname, page)) return base[method](href, as, options);
        setVisit({ page: target.pathname, asPath: `${target.pathname}${target.search}` });
        onPageChange(target.pathname);
        return Promise.resolve(true);
      };
    return {
      ...base,
      pathname: page,
      route: page,
      asPath,
      query: Object.fromEntries(current.searchParams),
      push: navigate('push'),
      replace: navigate('replace'),
    };
  }, [asPath, base, onPageChange, page]);

  // Storybook 的 next/link 只記錄點擊；連到其他頁時在這裡換頁。
  function followLink(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const href = (event.target as Element).closest('a[href]')?.getAttribute('href');
    if (!href) return;
    const target = new URL(href, window.location.origin);
    if (!otherPage(target.pathname, page)) return;
    event.preventDefault();
    void router.push(`${target.pathname}${target.search}`);
  }

  return (
    <RouterContext.Provider value={router}>
      {/* 跟 src/pages/_app.tsx 一樣，外框放在 .app-root 裡。 */}
      <div className="app-root" onClickCapture={followLink}>
        <AppShell>
          <StatefulRouter key={asPath}>{pages[page].content}</StatefulRouter>
        </AppShell>
      </div>
    </RouterContext.Provider>
  );
}

/**
 * 網站外框本身：左側側欄、頂部列（頁面名稱、深淺色切換、本機保存或雲端同步）與存檔警告，
 * 主內容是那一頁實際的畫面。範例資料是四科都有作答紀錄、難題與筆記的使用者，
 * 從「每日練習」開始。
 *
 * 畫面上可以操作看到：
 * - 點側欄的頁面或左上角的網站名稱（首頁）換頁，側欄標示與頂部列的頁面名稱跟著換
 *   （Controls 的 page 也跟著更新）；滑過或點「我的作答存摺」彈出子選單，子頁面時
 *   「我的作答存摺」標示為目前位置。頁面裡的操作照常，例如歷屆試題、使用者筆記點題號換題。
 * - 點側欄的「設定」在原頁面上開啟設定視窗，可以展開閱讀設定、介面配色設定；
 *   按右上角的關閉、背景或 Esc 關閉。設定頁（/settings）本身從 Controls 的 page 選。
 * - 頂部列的深淺色切換。
 * - 工具列切到手機寬度：側欄收進左上角的「開啟選單」抽屜，「我的作答存摺」往下展開子選單，
 *   頂部列的按鈕只剩圖示。
 *
 * 工具列的「雲端同步」看正式網站頂部列右上角的「同步作答」：未登入、登入中、已登入
 * （使用者名稱與登出圖示）、同步中、登入失敗（下方跳出紅色的錯誤說明）。
 */
const meta = {
  title: 'Layouts/網站外框/側欄與頂部列',
  component: AppShell,
  args: { page: '/practice', children: null },
  argTypes: {
    page: {
      control: {
        type: 'select',
        labels: Object.fromEntries(
          Object.entries(pages).map(([path, { label }]) => [path, `${label}（${path}）`]),
        ),
      },
      options: Object.keys(pages),
    },
    children: { table: { disable: true } },
  },
  parameters: {
    ...pageParameters('/practice'),
    appState: {
      ...attemptsAppState(personalAttempts),
      ...notesAppState,
      difficultQuestionIds: personalDifficultIds,
    },
  },
  render: function Render({ page }) {
    const [, updateArgs] = useArgs<ShellArgs>();
    return <SitePages page={page} onPageChange={(next) => updateArgs({ page: next })} />;
  },
} satisfies Meta<ShellArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 有作答資料: Story = {};

/** 作答資料寫不進瀏覽器（空間已滿）：主內容上方出現警告。 */
export const 儲存空間已滿: Story = {
  beforeEach: failLocalStorageWrites('quota-exceeded'),
};

/** 瀏覽器不允許本機儲存（例如隱私模式）：主內容上方出現警告。 */
export const 無法本機儲存: Story = {
  beforeEach: failLocalStorageWrites('unavailable'),
};
