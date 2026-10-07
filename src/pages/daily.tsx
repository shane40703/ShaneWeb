import Head from 'next/head';
import { DailyPage } from '@/features/daily/daily-page';

export default function DailyRoute() {
  return (
    <>
      <Head><title>每日練習｜建築師考試</title></Head>
      <DailyPage />
    </>
  );
}
