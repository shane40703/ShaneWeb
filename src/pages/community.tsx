import Head from 'next/head';
import { CommunityPage } from '@/features/community/community-page';

export default function CommunityRoute() {
  return <>
    <Head>
      <title>社群連結｜建築師考試</title>
      <meta name="description" content="追蹤 noki 的 Threads，交流建築師備考心得、解題觀念與網站使用建議。" />
    </Head>
    <CommunityPage />
  </>;
}
