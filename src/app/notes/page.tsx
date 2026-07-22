import type { Metadata } from 'next';
import { ComingSoon } from '@/components/content/content';

export const metadata: Metadata = { title: '使用者筆記' };

export default function Page() {
  return <ComingSoon eyebrow="MY NOTES" title="使用者筆記" description="集中整理法條、公式與解題提醒。" symbol="✎" />;
}
