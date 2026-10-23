import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState, type MouseEvent } from 'react';
import {
  MemoryGalleryAdminLink,
  MemoryGalleryPage,
} from '@/features/memory-gallery/memory-gallery-page';
import { ResourceLayout } from '@/features/resources/resource-layout';
import { resourceGalleryHref } from '@/features/resources/resource-pages';
import {
  MEMORY_GALLERY_CATEGORIES,
  type MemoryGalleryCategory,
  type MemoryGalleryImage,
} from '@/lib/memory-gallery';
import { memoryGalleryItems } from '../../fixtures/resources';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 跟 src/pages/resources/memory-gallery/[[...category]].tsx 一樣的組合。網站上每個科目是
 * 另一個預先產生的頁面：同一個頁面元件換掉 category，搜尋文字會留著。Storybook 的連結
 * 只記錄點擊，所以點到科目頁的連結時，這裡照網站換掉 category。
 */
function MemoryGalleryRoute({
  items,
  category: initialCategory,
}: {
  items: MemoryGalleryImage[];
  category: MemoryGalleryCategory;
}) {
  const [category, setCategory] = useState(initialCategory);

  function followCategoryLink(event: MouseEvent) {
    const href = (event.target as Element).closest('a[href]')?.getAttribute('href');
    const next = MEMORY_GALLERY_CATEGORIES.find(
      (item) => resourceGalleryHref(item.id) === href,
    );
    if (next) setCategory(next.id);
  }

  return (
    <div style={{ display: 'contents' }} onClickCapture={followCategoryLink}>
      <ResourceLayout current="memory-gallery" actions={<MemoryGalleryAdminLink />}>
        <MemoryGalleryPage
          items={items}
          showHeader={false}
          category={category}
          categoryHref={resourceGalleryHref}
        />
      </ResourceLayout>
    </div>
  );
}

/**
 * 速記圖庫（/resources/memory-gallery）：網站實際的整理圖（public/memory-gallery）。
 * 第一個科目（法規）在 /resources/memory-gallery，其他科目在 /resources/memory-gallery/<科目>。
 * 右上角的「管理者上傳」只在開發模式出現；Storybook 跟本機開發伺服器一樣是開發模式，
 * 所以看得到，正式網站不會顯示。
 *
 * 畫面上可以操作看到：
 * - 切換科目：構造有兩張圖；環控、結構還沒有整理圖，顯示可以切換其他科目的說明。
 * - 搜尋圖片標題或說明：例如「樓梯」只剩一張；「防火區劃」找不到圖片，出現「清除搜尋」。
 * - 點圖片開啟放大檢視：縮放、拖曳閱讀；畫面窄時（例如手機寬度）太長的標題在一行內截斷
 *   （例如「採購法、都市計畫法……」）。
 */
const meta = {
  title: 'Layouts/速記圖庫/圖庫畫面',
  component: MemoryGalleryRoute,
  // Controls 換掉一開始的科目時重新打開這一頁。
  render: (args) => <MemoryGalleryRoute key={args.category} {...args} />,
  decorators: [withPageFrame],
  parameters: {
    ...pageParameters(
      '/resources/memory-gallery/[[...category]]',
      {},
      resourceGalleryHref('law'),
    ),
  },
  args: { items: memoryGalleryItems, category: 'law' },
  argTypes: {
    category: {
      options: MEMORY_GALLERY_CATEGORIES.map((item) => item.id),
      control: {
        type: 'inline-radio',
        labels: Object.fromEntries(
          MEMORY_GALLERY_CATEGORIES.map((item) => [item.id, item.label]),
        ),
      },
    },
  },
} satisfies Meta<typeof MemoryGalleryRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 範例圖庫: Story = {};

/** 整個圖庫都還沒有圖片，各科目數量都是 0。 */
export const 圖庫尚無圖片: Story = {
  args: { items: [] },
};
