import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LawClozePage } from '@/features/law-cloze/law-cloze-page';
import { PracticeLayout } from '@/features/practice/practice-layout';
import {
  clozeBeforeExpansionStorage,
  clozeInProgressStorage,
} from '../../fixtures/mock-exam';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * /practice/law-cloze 的練習畫面。頁面從瀏覽器讀這一輪的抽題與作答，沒有存檔會隨機抽題，
 * 所以故事一律給固定的一輪：10 題做到第 7 題，前面有全對、答錯與直接看答案，目前這題剛
 * 提交、有一空答錯。
 *
 * 畫面上可以操作看到：
 * - 下一題：無障礙規範題（4 空，附官方 PDF；填 90、80、80、1/50 提交就是全對）→ 建築法的
 *   條文延伸練習題 → 題庫裡最長的條文（最後一題，6 空）。
 * - 在空格輸入數字、提交答案（空格標紅綠、逐空比對、完整條文）、直接看答案（紅字原文答案，
 *   本題不計分）；最後一題做完出現本輪成績與「再練一輪」。
 * - 展開「法規版本與官方來源」「題型相關考古題」。
 * - 改上方的法規、考點、題數（有尚未套用的設定；建築法「執照申請期限」只有 5 題，選 10 題
 *   會提示題數不足），按「開始新測驗」重新抽題；新的一輪每題都直接看答案，本輪成績會寫
 *   不計答對率。
 * - 側欄「設定」→「閱讀設定」調整題目字體，條文與空格一起放大。
 */
const meta = {
  title: 'Layouts/法規克漏字/練習畫面',
  component: LawClozePage,
  // 跟 /practice/law-cloze 一樣：置中的窄版「返回每日練習」框架。
  decorators: [
    (Story) => (
      <PracticeLayout narrow>
        <Story />
      </PracticeLayout>
    ),
    withPageFrame,
  ],
  parameters: {
    ...pageParameters('/practice/law-cloze'),
    localStorage: clozeInProgressStorage,
  },
} satisfies Meta<typeof LawClozePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 練習中: Story = {};

/** 題庫擴充前開始的同一輪：保留原本的抽題順序，提示可以開始新測驗抽擴充後的題庫。 */
export const 題庫已擴充: Story = {
  parameters: { localStorage: clozeBeforeExpansionStorage },
};
