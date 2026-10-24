import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { SimpleSelect } from '@/components/ui/ui';

/** 跟考古題討論版「共享投稿」的投稿類型選單一樣（exams-page 的 postTypeLabels）。 */
const postTypeOptions = [
  { value: 'explanation', label: '題目詳解' },
  { value: 'supplement', label: '觀念補充' },
  { value: 'question', label: '提問' },
  { value: 'correction', label: '答案勘誤' },
];

/**
 * 下拉選單，放在考古題討論版右側的投稿欄（寬度大約是這樣）。
 *
 * 畫面上可以操作看到：點選單展開所有選項（目前的選項前面有勾勾），選了之後畫面跟著換，
 * Controls 也跟著更新；也可以用鍵盤（Tab、方向鍵、Enter）操作。
 */
const meta = {
  title: 'Components/基礎 UI/SimpleSelect',
  component: SimpleSelect,
  args: {
    label: '投稿類型',
    value: 'explanation',
    options: postTypeOptions,
    onValueChange: fn(),
  },
  argTypes: {
    value: { control: 'select', options: postTypeOptions.map((option) => option.value) },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <SimpleSelect
        {...args}
        onValueChange={(value) => {
          args.onValueChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
} satisfies Meta<typeof SimpleSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 投稿類型: Story = {};
