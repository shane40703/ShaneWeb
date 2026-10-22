import Head from 'next/head';
import { PracticePage } from '@/features/practice/practice-page';

export default function PracticeRoute() {
  return (
    <>
      <Head>
        <title>每日練習（新版）｜建築師考試</title>
      </Head>
      <PracticePage />
    </>
  );
}
