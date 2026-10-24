import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MemoryGalleryLightbox } from '@/features/memory-gallery/memory-gallery-lightbox';
import type { MemoryGalleryImage } from '@/lib/memory-gallery';
import {
  brokenFileGalleryItem,
  longTitleGalleryItem,
  stairsGalleryItem,
} from '../../fixtures/resources';

/** Controls 的 item 選單：速記圖庫實際的整理圖，加上讀不到的圖檔。 */
const galleryItems = {
  樓梯設置規定: stairsGalleryItem,
  長標題: longTitleGalleryItem,
  圖檔損毀: brokenFileGalleryItem,
};

/** 選單存的是選項名稱，Storybook 畫故事前才照 mapping 換成整理圖。 */
function itemChoice(name: keyof typeof galleryItems) {
  return name as unknown as MemoryGalleryImage;
}

/**
 * 速記圖庫的放大檢視。圖庫頁把按鈕蓋在整張圖片上（triggerClassName），這裡只看按鈕
 * 本身與開啟後的視窗：縮放工具列、可拖曳的圖片區、僅供線上檢視的說明。
 *
 * 畫面上可以操作看到：
 * - 點放大鏡按鈕開啟：圖片符合畫面（100%），「縮小」停用。
 * - 按「放大」：三次到 195%，可以拖曳移動；放大到上限 800% 後「放大」停用。
 *
 * Controls 的 item 可以切換：
 * - 「長標題」：畫面窄時（例如工具列切到手機寬度）標題在一行內截斷。
 * - 「圖檔損毀」：圖檔讀不到，開啟後顯示圖片載入失敗。
 */
const meta = {
  title: 'Components/歷屆試題資料集成/MemoryGalleryLightbox',
  component: MemoryGalleryLightbox,
  args: { item: itemChoice('樓梯設置規定') },
  argTypes: {
    item: {
      options: Object.keys(galleryItems),
      mapping: galleryItems,
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof MemoryGalleryLightbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 整理圖: Story = {};
