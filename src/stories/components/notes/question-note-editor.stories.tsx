import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  QuestionNoteEditor,
  type QuestionNoteDraft,
} from '@/components/question-note-editor';
import { fixtureImages, fixtureNoteContent } from '../../fixtures/app-state';
import { fixtureOptions } from '../../fixtures/question';
import {
  fixtureSubjectQuestions,
  imageQuestion,
  screenshotQuestion,
} from '../../fixtures/questions';

const questionOptions = fixtureOptions(
  {
    '有筆記與圖片（101 年法規第 15 題）': screenshotQuestion,
    '還沒寫過筆記（101 年法規第 8 題）': imageQuestion,
  },
  '有筆記與圖片（101 年法規第 15 題）',
);

/** 類似考題從整個範例題庫找。 */
const bank = fixtureSubjectQuestions();

/**
 * 我的筆記頁與考古題討論版「筆記」分頁共用的筆記編輯器。它自己沒有外框，由頁面的面板
 * 框起來（這裡用同樣的奶油紙框示意）。一開始的第 15 題已存的筆記用到所有文字格式，附兩張圖片。
 *
 * 畫面上可以操作看到：
 * - 「編輯筆記」打開即時編輯器與圖片上傳；「儲存筆記」回到已儲存的樣子，右下角出現「筆記已儲存」；
 *   「刪除筆記」先跳出確認視窗；「分享到考古題討論版」把筆記存成這題的詳解（Storybook 不連
 *   Firebase，跟網站沒設定雲端時一樣只存在這台裝置），分享成功記在 Actions 的 onShared。
 * - Controls 的 header：full 是我的筆記頁的樣子（標籤、來源、題號、題幹、答案列）；compact 是
 *   考古題討論版筆記分頁的樣子（只有題號與題幹）。showDifficultButton、showSimilarQuestions
 *   關掉就是討論版用的組合。question 換成還沒寫過筆記的題目：空白的筆記欄與提示文字。
 */
const meta = {
  title: 'Components/筆記與圖片/QuestionNoteEditor',
  component: QuestionNoteEditor,
  args: {
    question: questionOptions.initial,
    header: 'full',
    showDifficultButton: true,
    showSimilarQuestions: true,
    onDraftChange: fn(),
    onShared: fn(),
  },
  argTypes: {
    question: questionOptions.argType,
    header: {
      control: {
        type: 'inline-radio',
        labels: { full: '完整（我的筆記）', compact: '精簡（討論版）' },
      },
      options: ['full', 'compact'],
    },
    draft: { control: false, table: { disable: true } },
    questions: { control: false, table: { disable: true } },
  },
  parameters: {
    appState: {
      notes: { [screenshotQuestion.id]: fixtureNoteContent },
      noteImages: { [screenshotQuestion.id]: fixtureImages.slice(0, 2) },
    },
  },
  // 跟我的筆記頁一樣的一圈框；編輯器本身不畫框。
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: 820,
          padding: 24,
          border: 'var(--frame)',
          borderRadius: 'var(--radius-frame)',
          background: 'var(--surface)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  render: function Render(args) {
    // 頁面保存未儲存的草稿（依題目編號），這裡照做；換題目時編輯器重新打開。
    const [drafts, setDrafts] = useState<Record<string, QuestionNoteDraft>>({});
    return (
      <QuestionNoteEditor
        key={args.question.id}
        {...args}
        questions={bank}
        draft={drafts[args.question.id]}
        onDraftChange={(draft) => {
          args.onDraftChange(draft);
          setDrafts((current) => ({ ...current, [args.question.id]: draft }));
        }}
      />
    );
  },
} satisfies Meta<typeof QuestionNoteEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 我的筆記: Story = {};
