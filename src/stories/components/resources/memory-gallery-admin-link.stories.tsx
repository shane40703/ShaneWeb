import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MemoryGalleryAdminLink } from '@/features/memory-gallery/memory-gallery-page';

/**
 * 速記圖庫右上角的「管理者上傳」連結（到 /admin/memory-gallery）。上傳只能在本機
 * 開發伺服器使用，所以只在開發模式（NODE_ENV 不是 production）出現，正式網站不會顯示。
 * Storybook 跟本機開發伺服器一樣是開發模式，所以看得到。
 */
const meta = {
  title: 'Components/歷屆試題資料集成/MemoryGalleryAdminLink',
  component: MemoryGalleryAdminLink,
} satisfies Meta<typeof MemoryGalleryAdminLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 本機開發: Story = {};
