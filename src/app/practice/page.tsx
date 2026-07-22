import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PracticePage } from '@/features/practice/practice-page';

export const metadata: Metadata = { title: '隨機出題' };

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true">正在準備練習設定…</div>}>
      <PracticePage />
    </Suspense>
  );
}
