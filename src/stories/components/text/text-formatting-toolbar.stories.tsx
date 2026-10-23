import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRef, useRef, useState } from 'react';
import { fn } from 'storybook/test';
import attemptStyles from '@/components/attempt-review.module.css';
import { TextFormattingToolbar } from '@/components/text-formatting-toolbar';
import { fixtureNoteContent } from '../../fixtures/app-state';

/**
 * 文字格式工具列。工具列本身沒有輸入框，網站上一定搭配一個 textarea，這裡放在交卷結果
 * 「使用者筆記」的框裡（attempt-review 的 reviewNote），輸入框也用那裡的實際樣式。
 * 輸入框裡看到的是格式符號（`**`、`_`、`!!`、`^`、`~`），存檔後才顯示成格式。
 * 完整的筆記編輯區（標題、圖片、按鈕）請看 ReviewNoteEditor 的故事。
 *
 * 畫面上可以操作看到：
 * - 在輸入框選取文字（例如「供公眾使用之建築物」）再按「粗體」，前後加上 `**` 並保持選取；
 *   再按一次就拿掉（已經是粗體的「建築法第 5 條」也一樣）。
 * - 沒有選取文字時按按鈕（例如「紅字」），會插入「紅色文字」並選起來，方便直接改寫。
 * - 清空輸入框看沒有內容時的提示文字；工具列切到手機寬度時，按鈕排不下會換到第二行。
 */
const meta = {
  title: 'Components/文字/TextFormattingToolbar',
  component: TextFormattingToolbar,
  args: {
    value: fixtureNoteContent,
    ariaContext: '第 15 題',
    onChange: fn(),
    // 實際用的是 render 裡輸入框的 ref。
    textareaRef: createRef<HTMLTextAreaElement>(),
  },
  argTypes: {
    value: { control: 'text' },
    textareaRef: { control: false },
  },
  // Docs 的程式碼顯示故事原始碼：自動產生的 JSX 會讀到輸入框的 ref，React 19 會在 console 報錯。
  parameters: { docs: { source: { type: 'code' } } },
  // 交卷結果的題目欄大約這麼寬。
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState(args.value);
    // 輸入框的內容跟網站一樣由這裡保存；Controls 改了 value 時才換成新的內容。
    const [argValue, setArgValue] = useState(args.value);
    if (args.value !== argValue) {
      setArgValue(args.value);
      setValue(args.value);
    }
    function change(nextValue: string) {
      args.onChange(nextValue);
      setValue(nextValue);
    }
    return (
      <section className={attemptStyles.reviewNote}>
        <TextFormattingToolbar
          {...args}
          textareaRef={textareaRef}
          value={value}
          onChange={change}
        />
        <textarea
          ref={textareaRef}
          aria-label={`${args.ariaContext ?? ''}筆記內容`}
          value={value}
          onChange={(event) => change(event.target.value)}
          rows={4}
          placeholder="在檢討答案時記下法條、公式或易錯觀念，也可以直接貼上截圖…"
        />
      </section>
    );
  },
} satisfies Meta<typeof TextFormattingToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 有內容: Story = {};
