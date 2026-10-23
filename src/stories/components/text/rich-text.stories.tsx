import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RichText } from '@/components/rich-text';
import notesStyles from '@/features/notes/notes-page.module.css';
import { fixtureNoteContent } from '../../fixtures/app-state';

/**
 * 題目與筆記的文字格式：`**粗體**`、`_斜體_`、`^上標^`、`~下標~`、`!!紅字!!`，格式可以
 * 互相包住（例如紅色粗體），網址自動變成在新分頁開啟的連結，換行與 Tab 縮排會保留。
 * 放在使用者筆記「已儲存筆記內容」的框裡（notes-page 的 noteResult），寬度大約是筆記欄的寬度。
 *
 * 範例文字前三行是使用者筆記的範例，每一種格式都有；最後是很長的網址，工具列切到手機寬度時
 * 會換行、不會撐破版面。Controls 的 children 可以直接改文字試其他寫法。
 */
const meta = {
  title: 'Components/文字/RichText',
  component: RichText,
  args: {
    children: [
      fixtureNoteContent,
      '!!**罰鍰新臺幣 9 萬元以上 45 萬元以下**!!，_屆期仍未改善者_ 得連續處罰。',
      '1. 先找出建築物用途分類。\n\t（例外規定另見施行細則）',
      '參考資料：https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=101090&c=101&s=0101&q=1 請對照第 15 題。',
    ].join('\n'),
  },
  argTypes: { children: { control: 'text' } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <section className={notesStyles.noteResult} aria-label="已儲存筆記內容">
          <p>
            <Story />
          </p>
        </section>
      </div>
    ),
  ],
} satisfies Meta<typeof RichText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 全部格式: Story = {};
