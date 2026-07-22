import type { Metadata } from 'next';
import { ComingSoon } from '@/components/content/content';

export const metadata: Metadata = { title: '匿名詳解與討論' };

export default function Page() {
  return <ComingSoon eyebrow="COMMUNITY" title="匿名詳解與討論" description="閱讀解法、補充觀念並針對題目交流。" symbol="◎" />;
}
