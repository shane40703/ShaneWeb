import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AttachmentGallery } from '@/components/image-attachments';
import { fixtureImages } from '../../fixtures/app-state';
import { fixtureOptions } from '../../fixtures/question';

const imageOptions = fixtureOptions(
  {
    一張圖片: fixtureImages.slice(0, 1),
    兩張圖片: fixtureImages.slice(0, 2),
    四張圖片: fixtureImages,
  },
  '四張圖片',
);

/**
 * 詳解、討論投稿與筆記裡的圖片牆。沒有圖片時不顯示。
 *
 * 畫面上可以操作看到：滑過圖片（或按 Tab 選到）左下角出現放大按鈕，點了是全螢幕放大的
 * ImageLightbox，按背景、右上角或 Esc 關閉。用 Controls 的 images 換張數。
 */
const meta = {
  title: 'Components/筆記與圖片/AttachmentGallery',
  component: AttachmentGallery,
  args: { images: imageOptions.initial },
  argTypes: { images: imageOptions.argType },
} satisfies Meta<typeof AttachmentGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 圖片牆: Story = {};
