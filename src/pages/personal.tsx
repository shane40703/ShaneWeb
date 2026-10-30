import Head from 'next/head';
import { PersonalHubPage } from '@/features/personal/personal-hub-page';

export default function PersonalRoute() {
  return (
    <>
      <Head>
        <title>我的作答存摺｜建築師考試</title>
      </Head>
      <PersonalHubPage />
    </>
  );
}
