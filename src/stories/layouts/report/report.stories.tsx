import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ReportPage from '@/pages/report';
import { pageParameters, withPageFrame } from '../../support/story-environment';

/**
 * 問題回報（/report）。從題目的「回報問題」進來時網址帶 `?question=題目編號&from=來源頁`，
 * 題目編號已自動填好；從側欄進來時題目編號是空白的。
 * 預設是 Storybook 不連 Firebase 的版本：回報只保存在目前瀏覽器，不需要登入就能送出。
 *
 * 畫面上可以操作看到：還沒填說明時「送出問題回報」不能按；選問題類型、輸入說明後可以送出，
 * 送出後清空說明並在右下角跳出「問題已回報」通知；清空題目編號就是從側欄進來的空白表單。
 *
 * 工具列的「雲端同步」切到雲端未登入時，多一個「使用 Google 登入」按鈕，沒登入不能送出；
 * 切到已登入就能送出（Storybook 不會連到 Firebase，回報不會真的送出）。
 */
const meta = {
  title: 'Layouts/問題回報/回報表單',
  component: ReportPage,
  decorators: [withPageFrame],
  parameters: {
    ...pageParameters('/report', { question: 'law-101-15', from: '/practice/quiz?q=1' }),
  },
} satisfies Meta<typeof ReportPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 從題目回報: Story = {};
