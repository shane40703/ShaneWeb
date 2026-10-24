import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState, type ComponentProps, type MouseEvent } from 'react';
import { MemoryGalleryAdminLink } from '@/features/memory-gallery/memory-gallery-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { resourcePages, resourcesHub } from '@/features/resources/resource-pages';
import { lawDatabaseEntries } from '../../fixtures/resources';

type ResourceLayoutProps = ComponentProps<typeof ResourceLayout>;
type Current = ResourceLayoutProps['current'];

/** 跟各頁傳給 ResourceLayout 的一樣：速記圖庫右側有「管理者上傳」，法規資料庫說明前面有法規數量。 */
const pageExtras: Partial<
  Record<Current, Pick<ResourceLayoutProps, 'actions' | 'facts'>>
> = {
  'memory-gallery': { actions: <MemoryGalleryAdminLink /> },
  laws: { facts: `收錄考題曾出現的 ${lawDatabaseEntries.length} 項法規；` },
};

/** 分頁列的連結會換到另一頁；這裡點分頁時直接換成那一頁的頁首。 */
function currentOf(href: string | null | undefined): Current | undefined {
  if (href === resourcesHub.href) return 'overview';
  return resourcePages.find((page) => page.href === href)?.id;
}

function ResourceLayoutPages({ current: initialCurrent }: ResourceLayoutProps) {
  const [current, setCurrent] = useState(initialCurrent);

  function followSectionLink(event: MouseEvent) {
    const href = (event.target as Element).closest('a[href]')?.getAttribute('href');
    const next = currentOf(href);
    if (next) setCurrent(next);
  }

  return (
    <div onClickCapture={followSectionLink}>
      <ResourceLayout current={current} {...pageExtras[current]}>
        {null}
      </ResourceLayout>
    </div>
  );
}

/**
 * 歷屆試題資料集成各頁共用的頁首：切換總覽與三個子頁的分頁列、右側動作按鈕、頁面說明。
 * 這裡只看頁首本身，頁面內容（children）留空。
 *
 * 畫面上可以操作看到：點分頁列切換各頁的頁首。總覽只有分頁列；速記圖庫右側有
 * 「管理者上傳」（只在開發模式出現，Storybook 也是開發模式，正式網站不會顯示）；
 * 法規資料庫的說明前面多了法規數量（facts）。
 */
const meta = {
  title: 'Components/歷屆試題資料集成/ResourceLayout',
  component: ResourceLayout,
  // Controls 換掉一開始的頁面時重新開始。
  render: (args) => <ResourceLayoutPages key={args.current} {...args} />,
  args: { current: 'memory-gallery', children: null },
  argTypes: {
    current: {
      options: ['overview', ...resourcePages.map((page) => page.id)],
      control: {
        type: 'inline-radio',
        labels: {
          overview: resourcesHub.shortLabel,
          ...Object.fromEntries(resourcePages.map((page) => [page.id, page.label])),
        },
      },
    },
    actions: { control: false },
    facts: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof ResourceLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 各頁頁首: Story = {};
