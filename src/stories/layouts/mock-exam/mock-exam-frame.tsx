import type { Decorator } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import { PracticeLayout } from '@/features/practice/practice-layout';
import pageStyles from '@/features/practice/practice-page.module.css';

/**
 * 跟 /practice/mock-exam 一樣的外層：每日練習的「返回每日練習」框架。最外層的容器由
 * MockExamPage 自己畫。
 */
export const withMockExamFrame: Decorator = (Story) => (
  <PracticeLayout>
    <Story />
  </PracticeLayout>
);

/**
 * MockExamPage 最外層的容器。只有直接用 MockExamQuiz／MockExamResult 的故事（看題庫
 * 「載入中」「載入失敗」這類 props 才看得到的狀態）需要它：手機版排版靠這層的
 * container query 切換。
 */
export function MockExamPageRoot({ children, answering = false }: { children: ReactNode; answering?: boolean }) {
  return <div className={answering ? `${pageStyles.root} ${pageStyles.fullWidth}` : pageStyles.root}>{children}</div>;
}
