import Head from 'next/head';
import { HomePage } from '@/features/home/home-page';

export default function HomeRoute() {
  return (
    <>
      <Head><title>建築師考試考古題練習平台</title></Head>
      <HomePage />
    </>
  );
}
