import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState, type ComponentProps } from 'react';
import { QuestionNumberButton } from '@/components/question-number-button';

type SampleProps = Omit<
  ComponentProps<typeof QuestionNumberButton>,
  'children' | 'ariaLabel' | 'onClick'
> & { label: string; number?: string };

/**
 * 網站上會出現的題號狀態：綠色答對（模擬考結果是得分）、紅色答錯（蓋過綠色）、橘色底線
 * 難題、紫點是有筆記（筆記頁）或有詳解或討論（考古題討論版）。模擬考作答中是答案卡：不用
 * 狀態色，鉛筆色底加所選字母是已作答，折角是難題（右上）與待檢查（左上）。
 */
const samples: SampleProps[] = [
  { label: '未作答', active: false },
  { label: '目前題目', active: true },
  { label: '答對', active: false, answered: true },
  { label: '答錯', active: false, answered: true, wrong: true },
  { label: '難題', active: false, difficult: true },
  { label: '目前題目且是難題', active: true, difficult: true },
  { label: '答對且是難題', active: false, answered: true, difficult: true },
  { label: '答錯且是難題', active: false, answered: true, wrong: true, difficult: true },
  { label: '有筆記', active: false, noted: true },
  { label: '有詳解或討論', active: false, hasContent: true },
  { label: '有筆記也有詳解', active: false, noted: true, hasContent: true },
  { label: '申論題題號', number: '申1', active: false, noted: true },
  { label: '答案卡未作答', active: false, sheet: true },
  { label: '答案卡已作答', active: false, sheet: true, answer: 'B' },
  { label: '答案卡目前題目', active: true, sheet: true, answer: 'B' },
  { label: '答案卡難題', active: false, sheet: true, difficult: true },
  { label: '答案卡待檢查', active: false, sheet: true, answer: 'C', review: true },
  {
    label: '答案卡目前題目兩種折角',
    active: true,
    sheet: true,
    answer: 'A',
    difficult: true,
    review: true,
  },
];

function Sample({ label, number = '12', active: initialActive, ...props }: SampleProps) {
  const [active, setActive] = useState(initialActive);
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 8, width: 112 }}>
      <QuestionNumberButton
        {...props}
        ariaLabel={`第 ${number} 題`}
        active={active}
        onClick={() => setActive((value) => !value)}
      >
        {number}
      </QuestionNumberButton>
      <small style={{ color: 'var(--text-soft)', fontSize: 12, textAlign: 'center' }}>
        {label}
      </small>
    </div>
  );
}

/**
 * 每日抽題練習、模擬考、考古題討論版、筆記頁共用的題號按鈕，所有狀態並排比較。
 * 實際的題號排列見 QuestionNumberGrid、QuestionNumberPicker。
 *
 * 畫面上可以操作看到：點任一個題號切換成「目前題目」或取消。
 */
const meta = {
  title: 'Components/題目/QuestionNumberButton',
  component: QuestionNumberButton,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof QuestionNumberButton>;

export default meta;

export const 所有狀態: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 12px' }}>
      {samples.map((sample) => (
        <Sample key={sample.label} {...sample} />
      ))}
    </div>
  ),
};
