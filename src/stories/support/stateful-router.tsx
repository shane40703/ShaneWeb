import type { Decorator } from '@storybook/nextjs-vite';
import { useRouter, type NextRouter } from 'next/router';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';

type Href = Parameters<NextRouter['push']>[0];
type Query = NextRouter['query'];

function searchOf(query: Record<string, unknown> | string | null | undefined) {
  if (typeof query === 'string') return query.replace(/^\?/, '');
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) search.append(key, String(item));
    }
  }
  return search.toString();
}

function queryOf(search: URLSearchParams): Query {
  const query: Query = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}

/** 把 push／replace 收到的網址換成「路徑?參數」，沒有路徑時就是目前這一頁。 */
function resolveHref(href: Href, current: URL) {
  if (typeof href === 'string') return new URL(href, current);
  const search = searchOf(href.query as Record<string, unknown> | string | null);
  return new URL(
    `${href.pathname ?? current.pathname}${search ? `?${search}` : ''}`,
    current,
  );
}

/**
 * Storybook 的 next/router 是固定的假路由：push／replace 只會出現在 Actions 面板，網址
 * 不會變。用網址參數切換畫面的頁面（歷屆試題、使用者筆記、模擬考、考題分析……）包上
 * 這個元件後，同一頁的 push／replace 會真的換掉網址參數，頁面就跟網站一樣跟著更新；
 * 同一頁的連結與 #錨點也照網站一樣在頁面內切換。換到其他頁的網址只記錄、不切換。
 */
export function StatefulRouter({ children }: { children: ReactNode }) {
  const base = useRouter();
  const [asPath, setAsPath] = useState(base.asPath);
  const router = useMemo<NextRouter>(() => {
    const current = new URL(asPath, window.location.origin);
    // 動態路由的參數（例如 [[...category]]）不在網址參數裡，一直保留。
    const routeParams = Object.fromEntries(
      Object.entries(base.query).filter(
        ([key]) => !new URL(base.asPath, window.location.origin).searchParams.has(key),
      ),
    );
    const navigate =
      (method: 'push' | 'replace') =>
      (...[href, as, options]: Parameters<NextRouter['push']>) => {
        void base[method](href, as, options);
        const next = resolveHref(href, current);
        if (next.pathname !== current.pathname) return Promise.resolve(true);
        setAsPath(`${next.pathname}${next.search}`);
        if (next.hash) jumpTo(next.hash);
        return Promise.resolve(true);
      };
    return {
      ...base,
      asPath: `${current.pathname}${current.search}`,
      query: { ...routeParams, ...queryOf(current.searchParams) },
      push: navigate('push'),
      replace: navigate('replace'),
    };
  }, [asPath, base]);

  // Storybook 的 next/link 只記錄點擊；同一頁的連結改由這裡切換。
  function followLink(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = (event.target as Element).closest('a[href]')?.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) {
      event.preventDefault();
      jumpTo(href);
      return;
    }
    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname !== base.pathname) {
      return;
    }
    event.preventDefault();
    void router.push(`${target.pathname}${target.search}${target.hash}`);
  }

  return (
    <RouterContext.Provider value={router}>
      <div style={{ display: 'contents' }} onClickCapture={followLink}>
        {children}
      </div>
    </RouterContext.Provider>
  );
}

/** 跟 Next 的路由一樣，跳到錨點時不用平滑捲動（網站預設是平滑捲動）。 */
function jumpTo(hash: string) {
  document
    .getElementById(decodeURIComponent(hash.slice(1)))
    ?.scrollIntoView({ behavior: 'instant' });
}

/** 放在 meta 的 decorators，排在 withPageFrame 前面（頁面框架裡的側欄連結不受影響）。 */
export const withStatefulRouter: Decorator = (Story) => (
  <StatefulRouter>
    <Story />
  </StatefulRouter>
);
