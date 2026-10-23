import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CategoryAdminPage } from '@/features/admin/category-admin-page';
import { adminQuestionSummaries, classificationApi } from '../../fixtures/admin';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 作者用的題目分類管理（/admin/categories）。props 照 getStaticProps 用範例題庫的選擇題
 * 摘要，法規 114 年當作剛匯入題庫、細分考點還沒填。打開時預設列出「類似題目尚未人工
 * 分類」的 114 年題目，右邊編輯第 1 題。
 *
 * 畫面上可以操作看到：
 * - 年度選 113 或 101 年：都已分類，清單空白、右邊顯示「沒有可編輯的題目」。
 * - 檢核狀態選「全部題目」或「待檢核」（只有 114 年第 74 題），搜尋題幹（例如「防火」），
 *   點清單裡的題目換右邊編輯的題目（113 年第 33 題題幹很長）。
 * - 科目選建築環境控制等非法規科目：沒有細分考點欄位，也沒有「類似題目尚未人工分類」。
 * - 新增、移除分類（全部移除時顯示「尚未選擇分類」、不能儲存），填細分考點。
 * - 沒輸入作者編輯金鑰就按「驗證並儲存」：底部紅字提示。輸入 author-key 再按：儲存中… →
 *   成功訊息，這題的分類與細分考點換成剛存的內容；再點清單裡的其他題目，填了細分考點的
 *   題目就離開「類似題目尚未人工分類」（剩 79 題）。輸入其他金鑰：底部顯示伺服器的
 *   「作者編輯金鑰不正確」。
 */
const meta = {
  title: 'Layouts/管理/題目分類管理',
  component: CategoryAdminPage,
  decorators: [withPageFrame],
  parameters: {
    ...pageParameters('/admin/categories'),
    fetchMocks: [classificationApi],
  },
  args: { questions: adminQuestionSummaries },
  argTypes: { questions: { control: false } },
} satisfies Meta<typeof CategoryAdminPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 類似題目待分類: Story = {};
