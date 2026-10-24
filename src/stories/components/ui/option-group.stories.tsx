import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { OptionGroup } from '@/components/ui/ui';
import { longQuestion, screenshotQuestion } from '../../fixtures/questions';

const optionLabels = { undefined: '未作答', 0: 'A', 1: 'B', 2: 'C', 3: 'D' };

/** Controls 的 options 選單：一般長度的選項、題庫裡選項很長的題目（構造 113 年）。 */
const optionSets = {
  一般選項: screenshotQuestion.options,
  長選項: longQuestion.options,
};

/** Controls 的 onToggleEliminated 選單：難題標記、常錯題目的「重新作答」沒有刪去選項的按鈕。 */
const eliminateModes = {
  有刪去按鈕: fn(),
  沒有刪去按鈕: undefined,
};

/**
 * 選擇題的選項（每日抽題練習、模擬考、重新作答）。從選了 C、刪去 A 和 D 開始。
 *
 * 畫面上可以操作看到：點選項換答案，再點同一個選項取消選擇；選項之間用淺線分隔。
 * 按右側的眼睛刪去或恢復選項（刪去的選項變淡、加刪除線，
 * 不能再選；已選的選項不能刪去）。Controls 也跟著更新。
 *
 * Controls 可以看到：value 選「未作答」、disabled 看按下「確認答案」之後選項與刪去按鈕都鎖住、
 * options 換成長選項、onToggleEliminated 換成沒有刪去按鈕（難題標記、常錯題目的「重新作答」，
 * 跟網站一樣不會有刪去的選項）。
 */
const meta = {
  title: 'Components/基礎 UI/OptionGroup',
  component: OptionGroup,
  args: {
    label: '第 1 題請選擇答案',
    // options 與 onToggleEliminated 存的是 Controls 選單上的名稱，Storybook 畫面前會照
    // argTypes 的 mapping 換成實際的值。
    options: '一般選項' as unknown as readonly string[],
    value: 2,
    disabled: false,
    eliminatedValues: [0, 3],
    onValueChange: fn(),
    onToggleEliminated: '有刪去按鈕' as unknown as (value: number) => void,
  },
  argTypes: {
    options: {
      control: 'inline-radio',
      options: Object.keys(optionSets),
      mapping: optionSets,
    },
    value: {
      control: { type: 'inline-radio', labels: optionLabels },
      options: [undefined, 0, 1, 2, 3],
    },
    eliminatedValues: {
      control: { type: 'inline-check', labels: optionLabels },
      options: [0, 1, 2, 3],
    },
    onToggleEliminated: {
      control: 'inline-radio',
      options: Object.keys(eliminateModes),
      mapping: eliminateModes,
    },
  },
  // 作答畫面的題目欄寬度大約是這樣。
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    const { onValueChange, onToggleEliminated, eliminatedValues = [] } = args;
    return (
      <OptionGroup
        {...args}
        // 網站上沒有刪去按鈕的地方（difficult-page、wrong-page）也不會傳刪去的選項。
        eliminatedValues={onToggleEliminated ? eliminatedValues : undefined}
        onValueChange={(value) => {
          onValueChange(value);
          updateArgs({ value });
        }}
        onToggleEliminated={
          onToggleEliminated
            ? (option) => {
                onToggleEliminated(option);
                updateArgs({
                  eliminatedValues: eliminatedValues.includes(option)
                    ? eliminatedValues.filter((item) => item !== option)
                    : [...eliminatedValues, option],
                });
              }
            : undefined
        }
      />
    );
  },
} satisfies Meta<typeof OptionGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 作答中: Story = {};
