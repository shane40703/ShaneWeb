import type { Metadata } from 'next';
import { ComingSoon } from '@/components/content/content';

export const metadata: Metadata = { title: '難題標記' };

export default function Page() {
  return <ComingSoon eyebrow="REVIEW" title="難題標記" description="集中重練標記題目，逐步消除弱點。" symbol="☆" />;
}
