import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DiscussionAdminPage from '@/pages/admin/discussions';
import {
  adminContentReports,
  adminDiscussionPosts,
  verifyKey,
} from '../../fixtures/admin';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 作者用的留言管理（/admin/discussions）：列出目前瀏覽器保存的留言與問題回報
 * （`parameters.appState`）。正式網站有設定雲端時，這頁也不讀雲端的投稿，畫面一樣。
 *
 * 畫面上可以操作看到：
 * - 輸入其他金鑰按「進入留言管理」：驗證中… → 「作者編輯金鑰錯誤」，停在輸入金鑰的畫面。
 * - 輸入 author-key 按「進入留言管理」：驗證中… → 解鎖後列出留言（含回覆、
 *   只有圖片的留言，顯示原始文字不套用格式）與問題回報（有指定題目、沒指定題目）。
 * - 「刪除留言」「刪除回報」：跳出確認視窗，確認後從清單移除；「刪除回覆」直接移除。
 * - 「鎖定後台」：回到輸入金鑰的畫面。
 */
const meta = {
  title: 'Layouts/管理/留言管理',
  component: DiscussionAdminPage,
  decorators: [withPageFrame],
  parameters: {
    ...pageParameters('/admin/discussions'),
    appState: {
      discussionPosts: adminDiscussionPosts,
      contentReports: adminContentReports,
    },
    fetchMocks: [verifyKey],
  },
} satisfies Meta<typeof DiscussionAdminPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 有留言與回報: Story = {};

export const 沒有留言與回報: Story = {
  parameters: { appState: { discussionPosts: [], contentReports: [] } },
};
