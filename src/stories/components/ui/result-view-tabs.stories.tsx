import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { ResultViewTabs } from '@/components/result-view-tabs';

/**
 * 作答結果的兩個分頁，預設是模擬考交卷結果（mock-exam-result）的文字。
 *
 * 畫面上可以操作看到：點分頁切換選取的樣式，Controls 也跟著更新。
 *
 * Controls 可以看到網站上其他地方的文字：reviewLabel／analysisLabel 換成歷屆試題作答履歷頁頂端的
 * 「每次作答紀錄／跨年度錯題分析」，或歷屆試題作答履歷裡展開單次紀錄時的「完整作答紀錄」。
 * 工具列切到手機寬度（560px 以下）時，分頁撐滿整列、平分寬度。
 */
const meta = {
  title: 'Components/基礎 UI/ResultViewTabs',
  component: ResultViewTabs,
  args: {
    value: 'review',
    onValueChange: fn(),
    idPrefix: 'mock-exam-result',
    ariaLabel: '作答結果分頁',
    reviewLabel: '逐題作答結果',
    analysisLabel: '錯題統計結果',
  },
  argTypes: {
    value: { control: 'inline-radio', options: ['review', 'wrong-analysis'] },
    reviewLabel: {
      control: 'inline-radio',
      options: ['逐題作答結果', '每次作答紀錄', '完整作答紀錄'],
    },
    analysisLabel: {
      control: 'inline-radio',
      options: ['錯題統計結果', '跨年度錯題分析'],
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <ResultViewTabs
        {...args}
        onValueChange={(value) => {
          args.onValueChange(value);
          updateArgs({ value });
        }}
      />
    );
  },
} satisfies Meta<typeof ResultViewTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 逐題作答結果: Story = {};
