import Head from 'next/head';
import { LawClozePage } from '@/features/law-cloze/law-cloze-page';
import { PracticeLayout } from '@/features/practice/practice-layout';

export default function PracticeLawClozeRoute() {
  return (
    <>
      <Head>
        <title>法規克漏字｜建築師考試</title>
      </Head>
      <PracticeLayout narrow>
        <LawClozePage />
      </PracticeLayout>
    </>
  );
}
