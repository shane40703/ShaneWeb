import Head from 'next/head';
import { HomePage } from '@/features/home/home-page';

export default function HomeRoute() {
  return (
    <>
      <Head><title>選擇科目｜建築師考試</title></Head>
      <HomePage />
    </>
  );
}
