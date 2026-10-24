import Head from 'next/head';
import { PracticeLayout } from '@/features/practice/practice-layout';
import { PracticePage } from '@/features/practice/practice-page';

export default function PracticeQuizRoute() {
  return (
    <>
      <Head>
        <title>每日抽題練習｜建築師考試</title>
      </Head>
      <PracticeLayout>
        <PracticePage />
      </PracticeLayout>
    </>
  );
}
