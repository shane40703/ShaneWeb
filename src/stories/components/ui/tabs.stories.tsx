import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { Tab, TabList, TabPanel, TabsRoot } from '@/components/tabs';

const tabLabels = { question: '題目', discussion: '討論區', notes: '筆記' };
const variantLabels = { outline: '外框', strip: '半透明底' };

const panelStyle = {
  margin: 0,
  padding: 24,
  border: 'var(--frame)',
  borderRadius: 'var(--radius-frame)',
  background: 'var(--surface)',
  color: 'var(--text-soft)',
  fontSize: 14,
  lineHeight: 1.6,
} as const;

/**
 * 分頁（考古題討論版的題目／討論區／筆記）有兩種樣式，用 Controls 的 variant 切換：
 * - 外框 outline（考古題討論版目前使用）：分頁放在方格紙上、直接接在有框的面板上方，面板的
 *   上框就是分頁下方的線。目前的分頁用同色框線圍住三邊、底部打開，和面板連成一張紙。
 * - 半透明底 strip：半透明的底鋪在方格紙上，格線透得過來，下緣一條鉛筆線。目前的分頁是不透明
 *   的底加 2px 墨線藍底線。
 *
 * 標籤旁可以放等寬字的數量（討論區的投稿數）。考古題討論版的頁面窄於 480px 時，分頁平分整列
 * 寬度。
 *
 * 畫面上可以操作看到：點分頁切換，目前分頁的形狀滑到新的分頁、下方內容跟著換；用 Tab 移到
 * 分頁列後按左右鍵切換；滑過與焦點框。Controls 的 value 也跟著更新。
 */
const meta = {
  title: 'Components/基礎 UI/Tabs',
  component: TabsRoot,
  args: {
    value: 'question',
    onValueChange: fn(),
    ariaLabel: '題目分頁',
    variant: 'outline',
    // 分頁與內容由 render 組出來，不在 Controls 調整。
    children: null,
  },
  argTypes: {
    value: {
      control: { type: 'inline-radio', labels: tabLabels },
      options: Object.keys(tabLabels),
    },
    variant: {
      control: { type: 'inline-radio', labels: variantLabels },
      options: Object.keys(variantLabels),
    },
    children: { control: false, table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 820 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return (
      <TabsRoot
        {...args}
        onValueChange={(value) => {
          args.onValueChange(value);
          updateArgs({ value });
        }}
      >
        <TabList>
          <Tab value="question">題目</Tab>
          <Tab value="discussion" badge={4}>
            討論區
          </Tab>
          <Tab value="notes">筆記</Tab>
        </TabList>
        <TabPanel value="question">
          <p style={panelStyle}>題目分頁：題幹、選項、看解答。</p>
        </TabPanel>
        <TabPanel value="discussion">
          <p style={panelStyle}>討論區分頁：4 則共享內容與投稿表單。</p>
        </TabPanel>
        <TabPanel value="notes">
          <p style={panelStyle}>筆記分頁：這一題的我的筆記。</p>
        </TabPanel>
      </TabsRoot>
    );
  },
} satisfies Meta<typeof TabsRoot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 三個分頁: Story = {};
