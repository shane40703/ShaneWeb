import type { Metadata } from 'next';
import { ComingSoon } from '@/components/content/content';

export const metadata: Metadata = { title: '考題分析' };

export default function Page() {
  return <ComingSoon eyebrow="INSIGHTS" title="考題分析" description="查看科目分布、命題頻率與個人弱點。" symbol="▥" />;
}
