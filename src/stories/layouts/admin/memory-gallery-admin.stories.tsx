import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MemoryGalleryAdminPage } from '@/features/memory-gallery/memory-gallery-admin-page';
import {
  galleryApi,
  galleryWriteFailed,
  memoryGalleryAdminItems,
  verifyKey,
} from '../../fixtures/admin';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 作者用的速記圖庫管理（/admin/memory-gallery）。props 照 getServerSideProps：圖庫用從
 * 網站圖庫索引（data/memory-gallery.json）複製的清單，`editingAvailable` 只有本機
 * npm run dev 才是 true。
 *
 * 畫面上可以操作看到：
 * - Controls 關掉 editingAvailable：正式網站的樣子，只有說明與提示，不能解鎖。
 * - 輸入 author-key 按「進入圖庫管理」：驗證中… → 上傳表單與已上傳圖片清單；「鎖定後台」
 *   回到輸入金鑰的畫面。輸入其他金鑰：說明下方顯示紅字「作者編輯金鑰錯誤」，表單仍鎖定。
 * - 「整理圖片」選電腦裡的圖片：顯示預覽，圖片標題自動帶入檔名；選 SVG 等其他格式或超過
 *   8 MB 的圖片會顯示格式提示；只填標題、沒選圖片就按上傳會提示先選圖片。
 * - 「上傳並儲存圖片」：處理中… → 提醒 commit／push 的訊息，剛選的圖片與標題排在清單
 *   最前面。
 * - 清單的「編輯」：表單換成修改圖片資料；「儲存圖片資料」後顯示成功訊息，清單換成剛改的
 *   標題、科目與說明。
 * - 清單的「下架」：跳出確認視窗，確認後圖片從清單移除並顯示下架說明。
 */
const meta = {
  title: 'Layouts/管理/速記圖庫管理',
  component: MemoryGalleryAdminPage,
  decorators: [withPageFrame],
  parameters: {
    ...pageParameters('/admin/memory-gallery'),
    fetchMocks: [verifyKey, ...galleryApi()],
  },
  args: { initialItems: memoryGalleryAdminItems, editingAvailable: true },
  argTypes: {
    initialItems: { control: false },
    editingAvailable: { control: 'boolean' },
  },
} satisfies Meta<typeof MemoryGalleryAdminPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 已上傳圖片: Story = {};

export const 尚未上傳圖片: Story = { args: { initialItems: [] } };

/** 伺服器寫入本機圖庫失敗：解鎖後上傳、修改或下架，都顯示伺服器的錯誤訊息。 */
export const 圖庫儲存失敗: Story = {
  parameters: { fetchMocks: [verifyKey, ...galleryWriteFailed] },
};
