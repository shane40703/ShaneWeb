import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PapersPage } from '@/features/papers/papers-page';

export const metadata: Metadata = { title: '歷屆試題' };

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true">正在準備題庫…</div>}>
      <PapersPage />
    </Suspense>
  );
}
