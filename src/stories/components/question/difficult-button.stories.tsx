import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { DifficultButton } from '@/components/difficult-button';

/**
 * 作答畫面、題目卡片、作答紀錄上的「標記為難題」按鈕。
 *
 * 畫面上可以操作看到：點一下切換「標記為難題」／「已標記難題」（Controls 的 active 跟著變）。
 */
const meta = {
  title: 'Components/題目/DifficultButton',
  component: DifficultButton,
  args: { active: false, onClick: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <DifficultButton
        active={args.active}
        onClick={() => {
          args.onClick();
          updateArgs({ active: !args.active });
        }}
      />
    );
  },
} satisfies Meta<typeof DifficultButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 難題按鈕: Story = {};
