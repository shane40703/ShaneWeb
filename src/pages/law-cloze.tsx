import Head from 'next/head';
import { LawClozePage } from '@/features/law-cloze/law-cloze-page';

export default function LawClozeRoute() {
  return <><Head><title>法規克漏字｜建築師考試</title></Head><LawClozePage /></>;
}
