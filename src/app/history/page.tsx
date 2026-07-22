import type { Metadata } from 'next';
import { ComingSoon } from '@/components/content/content';

export const metadata: Metadata = { title: '已作答紀錄' };

export default function Page() {
  return <ComingSoon eyebrow="HISTORY" title="已作答紀錄" description="按時間回顧每次作答結果與進步軌跡。" symbol="◷" />;
}
