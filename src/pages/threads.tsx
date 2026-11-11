import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';

export default function ThreadsRoute() {
  return (
    <>
      <Head>
        <title>Threads｜建築師考試</title>
        <meta
          name="description"
          content="追蹤 noki 的 Threads，看建築師大集結的網站動態，分享建築師考試的解題心得。"
        />
      </Head>
      <CommunityPage channel="threads" />
    </>
  );
}
