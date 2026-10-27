import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tag } from '@/components/content/content';
import contentStyles from '@/components/content/content.module.css';

/**
 * 題目、紀錄、投稿上的小標籤。四種顏色並排，間距跟題目列表的標籤列
 * （content.module.css 的 tagList）一樣：
 * - 藍色（預設）：年度、每日抽題練習作答時的科目、歷屆試題作答履歷的「歷屆試題模擬考」。
 * - 綠色：科目名稱；每日抽題練習的「年度・原題題號」（最長的標籤，放在最後）與結果頁的分類。
 * - 紫色：題號、申論題、示範題、每日抽題練習的分類與紀錄、投稿類型（勘誤以外）。
 * - 橙色：題目分類、投稿的「答案勘誤」。
 *
 * 各頁實際的標籤組合（順序、顏色）請看各頁的 Layouts 故事。
 */
const meta = {
  title: 'Components/基礎 UI/Tag',
  component: Tag,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Tag>;

export default meta;

export const 全部顏色: StoryObj = {
  render: () => (
    <div className={contentStyles.tagList}>
      <Tag>113 年</Tag>
      <Tag tone="green">建築法規與實務</Tag>
      <Tag tone="purple">第 15 題</Tag>
      <Tag tone="orange">建築法</Tag>
      <Tag tone="green">113 年・原題第 15 題</Tag>
    </div>
  ),
};
