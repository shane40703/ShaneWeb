import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ImageAttachments } from '@/components/image-attachments';
import { fixtureImages } from '../../fixtures/app-state';

/**
 * 使用者筆記的圖片上傳：每題最多 4 張、每張 2 MB 以下。
 *
 * 畫面上可以操作看到：
 * - 「上傳筆記圖片」選圖片加入；加到 4 張是上限，再上傳會出現紅字提示。
 * - 上傳超過 2 MB 的圖片：圖片不會加入，出現紅字提示。
 * - 圖片右上角移除（全部移除就是沒有圖片的樣子）；滑過圖片出現放大按鈕。
 * - Controls 的 label：按鈕文字（元件預設「上傳圖片」，網站的筆記都用「上傳筆記圖片」）。
 */
const meta = {
  title: 'Components/筆記與圖片/ImageAttachments',
  component: ImageAttachments,
  args: { images: fixtureImages.slice(0, 2), onChange: fn(), label: '上傳筆記圖片' },
  argTypes: { images: { control: false } },
  // 跟筆記編輯器一樣由外層保存圖片，故事裡可以直接上傳、移除。
  render: function Render(args) {
    const [images, setImages] = useState(args.images);
    return (
      <ImageAttachments
        {...args}
        images={images}
        onChange={(next) => {
          args.onChange(next);
          setImages(next);
        }}
      />
    );
  },
} satisfies Meta<typeof ImageAttachments>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 已經有兩張圖片。 */
export const 圖片上傳: Story = {};
