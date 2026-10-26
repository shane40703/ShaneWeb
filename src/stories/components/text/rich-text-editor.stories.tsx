import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { RichTextEditor } from '@/components/rich-text-editor';
import { fixtureNoteContent } from '../../fixtures/app-state';

/**
 * 筆記與投稿共用的即時編輯器：舊筆記的格式符號開啟後直接顯示效果，不在輸入框顯示代碼。
 * 選字後切換粗體／斜體／底線／刪除線／上下標；再點一次取消，也能先選格式再輸入。
 * 字色選單、自訂色盤與字級會立即套用選取範圍；清單、清除格式、復原與重做都能直接操作。
 * 控制列可切換 disabled、空白 value 或較小的 maxLength，看輸入限制提示。
 * 預設提示只在內容空白時顯示；打開既有筆記即隱藏，不必先點進去。清空、復原與重做也會同步切換提示。
 * 手機工具列會換行且保留 44px 操作高度。整個筆記與圖片流程請看 ReviewNoteEditor。
 */
const meta = {
  title: 'Components/文字/RichTextEditor',
  component: RichTextEditor,
  args: { value: fixtureNoteContent, onChange: fn(), ariaLabel: '筆記內容', ariaContext: '筆記', disabled: false, maxLength: 20000 },
  decorators: [(Story) => <div style={{ maxWidth: 760 }}><Story /></div>],
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>();
    return <RichTextEditor {...args} onChange={value => { args.onChange(value); updateArgs({ value }); }} />;
  },
} satisfies Meta<typeof RichTextEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const 即時編輯: Story = {};
