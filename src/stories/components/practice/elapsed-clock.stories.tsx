import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import { ElapsedClock } from '@/features/practice/practice-quiz';
import { createPracticeTimer } from '@/features/practice/practice-session';

/**
 * 作答畫面底部的作答時間：題組已作答時間的加總（savedSeconds），加上目前這題開著的秒數。
 * 跟作答畫面一樣每秒加一；Controls 的 savedSeconds 改成 3600 以上可以看超過一小時的樣子。
 */
const meta = {
  title: 'Components/每日練習/ElapsedClock',
  component: ElapsedClock,
  args: { timer: createPracticeTimer(), savedSeconds: 754 },
  argTypes: { timer: { control: false } },
  render: function Render({ savedSeconds }) {
    const [timer] = useState(createPracticeTimer);
    useEffect(() => {
      const interval = window.setInterval(() => timer.tick('story-question'), 1000);
      return () => window.clearInterval(interval);
    }, [timer]);
    return <ElapsedClock timer={timer} savedSeconds={savedSeconds} />;
  },
} satisfies Meta<typeof ElapsedClock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 計時中: Story = {};
